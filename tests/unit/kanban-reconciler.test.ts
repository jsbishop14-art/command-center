import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb, useTempKanban } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { reconcile, restoreCard, sourceRefExists } from "../../src/lib/kanban/reconciler";
import { newDir, cardsDir, cardFile, contextFile, archiveDir } from "../../src/lib/kanban/paths";
import { readCardFile, listCardIds, mutateCard, atomicWrite, ensureLayout } from "../../src/lib/kanban/store";
import { serializeCard, parseCard } from "../../src/lib/kanban/card";
import { readEntries } from "../../src/lib/kanban/activity";
import { listProblems } from "../../src/lib/kanban/state";
import { initKanbanRepo, commitKanban, lastCommitSubject } from "../../src/lib/kanban/git";

// Step 3: reconciler, new/ pickup, Problems, archive/restore, dedup, git backup.
// Covers handoff §11 "Kanban storage" checks 2, 3, 4, 5, 7, 8, 9, 11.

beforeEach(() => {
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureLayout();
});

function writeNew(name: string, text: string) {
  fs.writeFileSync(path.join(newDir(), name), text);
}

const NEW_CARD = `---
title: Card added by Duet
area: personal
boards: [josh]
created_by: duet
source: sync
---

Follow up.
`;

describe("new/ pickup (handoff §4.3; check 3)", () => {
  it("assigns the next id, moves to cards/, logs create", () => {
    writeNew("draft.md", NEW_CARD);
    const r = reconcile({ now: "2026-11-09T13:00:00-05:00" });
    expect(r.created).toEqual(["CC-0001"]);
    expect(fs.existsSync(path.join(newDir(), "draft.md"))).toBe(false);
    expect(fs.existsSync(cardFile("CC-0001"))).toBe(true);
    const c = readCardFile("CC-0001")!;
    expect(c.title).toBe("Card added by Duet");
    expect(c.created_by).toBe("duet");
    const log = readEntries("CC-0001");
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe("create");
    expect(log[0].actor).toBe("duet");
    // Context file generated (handoff §3.2).
    expect(fs.existsSync(contextFile("CC-0001"))).toBe(true);
  });

  it("ids increase in sequence", () => {
    writeNew("a.md", NEW_CARD);
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    writeNew("b.md", NEW_CARD.replace("source: sync", "source: sync\nsource_ref: ref-b"));
    reconcile({ now: "2026-11-09T13:01:00-05:00" });
    expect(listCardIds()).toEqual(["CC-0001", "CC-0002"]);
  });
});

describe("Problems (handoff §4.9; check 2)", () => {
  it("an invalid card file is listed in Problems with a reason and not dropped", () => {
    const bad = NEW_CARD; // no id — invalid as a cards/ file
    const file = cardFile("CC-0007");
    fs.writeFileSync(file, bad);
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    const problems = listProblems();
    expect(problems.some((p) => p.file === "cards/CC-0007.md")).toBe(true);
    // The file is still there (not dropped).
    expect(fs.existsSync(file)).toBe(true);
  });

  it("a new/ file missing a title goes to Problems and stays", () => {
    writeNew("notitle.md", "---\narea: business\n---\n\nbody\n");
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    expect(listProblems().some((p) => p.file === "new/notitle.md")).toBe(true);
    expect(fs.existsSync(path.join(newDir(), "notitle.md"))).toBe(true);
  });
});

describe("direct changes and attribution (handoff §4.6; checks 1, 7)", () => {
  it("a Claude hand-edit gets a log line with actor claude, run and before/after", () => {
    writeNew("c.md", NEW_CARD.replace("created_by: duet", "created_by: josh"));
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    const id = "CC-0001";
    // Claude edits the file directly on the Mac mini: move stage, set last_actor + last_run.
    const c = readCardFile(id)!;
    const edited = { ...c, stage: "in_progress" as const, updated: "2026-11-09T13:05:00-05:00", last_actor: "claude" as const, last_run: "sync-2026-11-09-1300" };
    atomicWrite(cardFile(id), serializeCard(edited));
    reconcile({ now: "2026-11-09T13:05:30-05:00" });
    const log = readEntries(id);
    const move = log.find((e) => e.action === "move")!;
    expect(move).toBeTruthy();
    expect(move.actor).toBe("claude");
    expect(move.run).toBe("sync-2026-11-09-1300");
    expect(move.before?.stage).toBe("inbox");
    expect(move.after?.stage).toBe("in_progress");
  });

  it("a direct change that did not update last_actor is logged as actor unknown", () => {
    writeNew("d.md", NEW_CARD.replace("created_by: duet", "created_by: josh"));
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    const id = "CC-0001";
    const c = readCardFile(id)!;
    // Change a field but leave last_actor/last_run as they were (josh, empty).
    const edited = { ...c, title: "Renamed by hand", updated: "2026-11-09T13:06:00-05:00" };
    atomicWrite(cardFile(id), serializeCard(edited));
    reconcile({ now: "2026-11-09T13:06:30-05:00" });
    const edit = readEntries(id).find((e) => e.action === "edit")!;
    expect(edit.actor).toBe("unknown");
  });

  it("unknown fields survive a rewrite through the store (check 5)", () => {
    writeNew("e.md", NEW_CARD.replace("source: sync", "source: sync\nx_custom: keep"));
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    const id = "CC-0001";
    mutateCard(id, (cur) => ({ ...cur, title: "new title", updated: "2026-11-09T13:07:00-05:00" }));
    expect(fs.readFileSync(cardFile(id), "utf8")).toContain("x_custom: keep");
  });
});

describe("two writers at once (handoff §4.7 rule 2; check 4)", () => {
  it("both changes are kept", () => {
    writeNew("f.md", NEW_CARD.replace("created_by: duet", "created_by: josh"));
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    const id = "CC-0001";
    let calls = 0;
    mutateCard(id, (cur) => {
      if (calls++ === 0) {
        // A competing writer changes a different field and bumps updated between read and write.
        const other = { ...cur, due: "2026-12-01", updated: "2026-11-09T13:08:00-05:00" };
        atomicWrite(cardFile(id), serializeCard(other));
      }
      return { ...cur, title: "mine", updated: "2026-11-09T13:08:30-05:00" };
    });
    const final = readCardFile(id)!;
    expect(final.title).toBe("mine");
    expect(final.due).toBe("2026-12-01");
  });
});

describe("archive and restore (handoff §4.9; check 8)", () => {
  it("a done card older than 30 days archives; restore brings it back", () => {
    writeNew("g.md", NEW_CARD.replace("created_by: duet", "created_by: josh"));
    reconcile({ now: "2026-11-01T12:00:00-05:00" });
    const id = "CC-0001";
    const c = readCardFile(id)!;
    const done = { ...c, stage: "done" as const, done_at: "2026-09-01T12:00:00-05:00", updated: "2026-09-01T12:00:00-05:00", last_actor: "josh" as const };
    atomicWrite(cardFile(id), serializeCard(done));
    const r = reconcile({ now: "2026-11-01T12:00:00-05:00" });
    expect(r.archived).toContain(id);
    expect(fs.existsSync(cardFile(id))).toBe(false);
    expect(fs.existsSync(path.join(archiveDir("2026"), `${id}.md`))).toBe(true);
    // Restore.
    const back = restoreCard(id, "2026-11-01T12:30:00-05:00");
    expect(back.stage).toBe("inbox");
    expect(fs.existsSync(cardFile(id))).toBe(true);
    const restoreLog = readEntries(id).find((e) => e.action === "restore");
    expect(restoreLog).toBeTruthy();
  });
});

describe("source_ref dedup (handoff §4.7 rule 7; check 9)", () => {
  it("a second new/ file with the same source_ref creates no duplicate", () => {
    writeNew("h1.md", NEW_CARD.replace("source: sync", "source: sync\nsource_ref: gmail-123"));
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    expect(listCardIds()).toEqual(["CC-0001"]);
    writeNew("h2.md", NEW_CARD.replace("source: sync", "source: sync\nsource_ref: gmail-123"));
    const r = reconcile({ now: "2026-11-09T13:01:00-05:00" });
    expect(r.created).toEqual([]);
    expect(listCardIds()).toEqual(["CC-0001"]);
    expect(sourceRefExists("gmail-123")).toBe(true);
  });
});

describe("git backup (handoff §4.10; check 11)", () => {
  it("commitKanban commits the folder when something changed", () => {
    // Create cards first, then make the folder a repo (so the reconciler's own hourly auto-commit
    // does not fire before this explicit commit — Sync-triggered commits arrive in CC7).
    writeNew("i.md", NEW_CARD);
    reconcile({ now: "2026-11-09T13:00:00-05:00" });
    initKanbanRepo();
    const made = commitKanban("kanban: sync-2026-11-09-1300");
    expect(made).toBe(true);
    expect(lastCommitSubject()).toBe("kanban: sync-2026-11-09-1300");
    // A second commit with no changes makes nothing.
    expect(commitKanban("noop")).toBe(false);
  });
});
