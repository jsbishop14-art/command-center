import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb, useTempKanban, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { ezbSync } from "../../src/lib/ezbinder/sync";
import { listProposals, getProposal } from "../../src/lib/ezbinder/proposals";
import { createPendingNote, listPending, confirmNote } from "../../src/lib/kanban/pending";
import { listCards, readCardFile } from "../../src/lib/kanban/store";
import { readEntries } from "../../src/lib/kanban/activity";
import { initKanbanRepo, lastCommitSubject } from "../../src/lib/kanban/git";
import { runSync, previewCounts } from "../../src/lib/sync/engine";
import { revertSyncChange, revertAllFromRun } from "../../src/lib/sync/revert";
import { getRun } from "../../src/lib/sync/store";
import { usageSummary, usage30Days } from "../../src/lib/sync/usage";

// CC7 — Sync with Claude, Revert and usage (spec §4; handoff §11 "AI usage"). Everything runs
// against the Claude stub: no real Claude call in CI or build sessions (spec §6; CLAUDE §3). No AI
// on any other path. No timers.

const SYNC_DIR = path.resolve(__dirname, "../../src/lib/sync");
const APP_DIR = path.resolve(__dirname, "../../src/app");
const LIB_DIR = path.resolve(__dirname, "../../src/lib");

async function fresh() {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  delete process.env.CC_LIVE_FEEDS;
  delete process.env.CC_LIVE_AI;
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  await ezbSync({ at: "2026-11-19T09:00:00-05:00" }); // seed EZ Binder jobs/tasks/money (stub)
}

const AT = "2026-11-19T10:00:00-05:00";

describe("CC7 run: items, changes and skipping (handoff §5.1)", () => {
  beforeEach(fresh);

  it("runs all three items and records a change for each source", async () => {
    createPendingNote({ via: "email", text: "Riverwood pool house punch list follow-up", at: AT });
    const run = await runSync({ items: ["inbox", "kanban", "schedule"], by: "josh", at: AT });

    expect(run.items.sort()).toEqual(["inbox", "kanban", "schedule"]);
    expect(run.skipped).toEqual([]);
    const kinds = run.changes.map((c) => c.kind);
    expect(kinds).toContain("inbox");
    expect(kinds).toContain("kanban");
    expect(kinds).toContain("schedule");
    // Kanban adds a card per cached job (2 scheduled jobs); schedule proposes per active/sold job (2).
    expect(run.changes.filter((c) => c.kind === "kanban").length).toBe(2);
    expect(run.changes.filter((c) => c.kind === "schedule").length).toBe(2);
  });

  it("an item with nothing new is skipped without a Claude usage row (handoff §5.1)", async () => {
    // No pending notes -> inbox has nothing new. Run only inbox.
    const run = await runSync({ items: ["inbox"], by: "josh", at: AT });
    expect(run.items).toEqual([]);
    expect(run.skipped).toEqual(["inbox"]);
    expect(run.changes).toEqual([]);
    expect(run.runItems.find((i) => i.item === "inbox")).toBeUndefined();
    expect(run.totalTokens).toBe(0);
  });

  it("an unchecked item does not run (handoff §5.1)", async () => {
    const run = await runSync({ items: ["schedule"], by: "josh", at: AT });
    expect(run.items).toEqual(["schedule"]);
    // No kanban cards created when kanban was not requested.
    expect(listCards().length).toBe(0);
    expect(run.changes.every((c) => c.kind === "schedule")).toBe(true);
  });

  it("Sort Inbox suggests a project/boards but files nothing (handoff §5.1 item 1)", async () => {
    createPendingNote({ via: "email", text: "Christine wants to plan a home vacation in July", at: AT });
    const before = listPending().length;
    const run = await runSync({ items: ["inbox"], by: "josh", at: AT });
    expect(listPending().length).toBe(before); // nothing filed into cards
    expect(listCards().length).toBe(0);
    const note = listPending()[0];
    expect(note.suggested_by).toBe("claude");
    expect(note.boards).toContain("christine"); // personal note -> Christine board
    expect(run.changes[0].kind).toBe("inbox");
  });

  it("Schedule proposals are sent with source claude and change nothing in EZ Binder yet (handoff §2.2)", async () => {
    await runSync({ items: ["schedule"], by: "josh", at: AT });
    const claude = listProposals().filter((p) => p.source === "claude");
    expect(claude.length).toBe(2);
    expect(claude.every((p) => p.status === "proposed")).toBe(true);
    expect(claude.every((p) => p.actor === "claude")).toBe(true);
  });

  it("Kanban adds respect the Claude limits (never done/discarded; §4.7 rule 8)", async () => {
    const run = await runSync({ items: ["kanban"], by: "josh", at: AT });
    for (const c of run.changes) {
      const card = readCardFile(c.target)!;
      expect(["done", "discarded"]).not.toContain(card.stage);
      expect(card.last_actor).toBe("claude");
    }
  });
});

describe("CC7 usage (handoff §5.5; spec check 2)", () => {
  beforeEach(fresh);

  it("a run's usage line equals the sum of its per-item usage (spec check 2)", async () => {
    createPendingNote({ via: "email", text: "Garcia pool deck permit update", at: AT });
    const run = await runSync({ items: ["inbox", "kanban", "schedule"], by: "josh", at: AT });
    const sum = run.runItems.reduce((s, i) => s + i.tokens, 0);
    expect(sum).toBeGreaterThan(0);
    expect(run.totalTokens).toBe(sum);
    expect(getRun(run.id)!.totalTokens).toBe(sum);
  });

  it("the dashboard-this-week and last-run tiles reflect the run", async () => {
    const run = await runSync({ items: ["kanban"], by: "josh", at: AT });
    const now = new Date();
    const u = usageSummary(now);
    expect(u.lastRunTokens).toBe(run.totalTokens);
    expect(u.weekTokens).toBeGreaterThanOrEqual(run.totalTokens);
    expect(u.planPct).toBeNull(); // no weekly plan figure set
  });

  it("the 30-day panel has a slot per day and splits tokens by item", async () => {
    await runSync({ items: ["kanban"], by: "josh", at: AT });
    const days = usage30Days("2026-11-19");
    expect(days.length).toBe(30);
    const today = days.find((d) => d.date === "2026-11-19")!;
    expect(today.kanban).toBeGreaterThan(0);
    expect(today.inbox).toBe(0);
  });

  it("previewCounts matches what a run would do", async () => {
    createPendingNote({ via: "email", text: "a note", at: AT });
    const p = previewCounts();
    expect(p.inbox).toBe(1);
    expect(p.kanban).toBe(2);
    expect(p.schedule).toBe(2);
  });
});

describe("CC7 Revert and Revert all (handoff §5.4; spec check 1)", () => {
  beforeEach(fresh);

  it("Revert all undoes every change from a run and is logged (spec check 1)", async () => {
    createPendingNote({ via: "email", text: "Riverwood pool house note", at: AT });
    const run = await runSync({ items: ["inbox", "kanban", "schedule"], by: "josh", at: AT });
    const changeCount = run.changes.length;
    expect(changeCount).toBeGreaterThan(0);

    const result = await revertAllFromRun("josh", run.id, { at: "2026-11-19T11:00:00-05:00" });
    expect(result.reverted).toBe(changeCount);

    const after = getRun(run.id)!;
    expect(after.changes.every((c) => c.revertedAt)).toBe(true);

    // Kanban cards are discarded; schedule proposals rejected; the suggestion is cleared.
    for (const c of after.changes) {
      if (c.kind === "kanban") expect(readCardFile(c.target)!.stage).toBe("discarded");
      if (c.kind === "schedule") expect(getProposal(Number(c.target))!.status).toBe("rejected");
      if (c.kind === "inbox") expect(listPending().find((n) => n.id === c.target)!.suggested_at).toBeNull();
    }
    // The revert is logged (a revert/discard line exists for a reverted card).
    const kanbanChange = after.changes.find((c) => c.kind === "kanban")!;
    const entries = readEntries(kanbanChange.target);
    expect(entries.some((e) => e.actor === "josh")).toBe(true);
  });

  it("a single Revert of a schedule proposal withdraws it", async () => {
    const run = await runSync({ items: ["schedule"], by: "josh", at: AT });
    const change = run.changes[0];
    const out = await revertSyncChange("josh", run.id, change.seq, { at: "2026-11-19T11:00:00-05:00" });
    expect(out.status).toBe("reverted");
    expect(getProposal(Number(change.target))!.status).toBe("rejected");
    // Reverting again is a no-op (already reverted).
    const again = await revertSyncChange("josh", run.id, change.seq, {});
    expect(again.status).toBe("already");
  });

  it("reverting a Sync kanban add discards the card as the reverter", async () => {
    const run = await runSync({ items: ["kanban"], by: "christine", at: AT });
    const change = run.changes[0];
    await revertSyncChange("christine", run.id, change.seq, { at: "2026-11-19T11:00:00-05:00" });
    expect(readCardFile(change.target)!.stage).toBe("discarded");
    expect(getRun(run.id)!.changes.find((c) => c.seq === change.seq)!.revertedAt).not.toBeNull();
  });

  it("an inbox suggestion revert fails gracefully once the note is confirmed", async () => {
    createPendingNote({ via: "email", text: "Maple St kitchen note", at: AT });
    const run = await runSync({ items: ["inbox"], by: "josh", at: AT });
    const noteId = run.changes[0].target;
    confirmNote(noteId, {}, "josh", AT); // the note becomes a card and leaves pending/
    const out = await revertSyncChange("josh", run.id, run.changes[0].seq, {});
    expect(out.status).toBe("missing");
  });
});

describe("CC7 git backup after every Sync (handoff §4.10, spec §3)", () => {
  beforeEach(fresh);

  it("commits the kanban folder with the run id in the message", async () => {
    initKanbanRepo();
    const run = await runSync({ items: ["kanban"], by: "josh", at: AT });
    expect(lastCommitSubject()).toBe(`Sync ${run.id}`);
  });
});

describe("CC7 nothing calls Claude except Sync (handoff §5, §8; spec check)", () => {
  beforeEach(fresh);

  it("only the sync module references the Claude client", () => {
    // Static scan: no file outside src/lib/sync imports the Claude client (claude.ts). Mirrors the
    // CC6 QuickBooks scan. The Sync button is the only caller of the engine, which is the only
    // caller of the client.
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(f)) continue;
        if (full.startsWith(SYNC_DIR)) continue;
        const text = fs.readFileSync(full, "utf8");
        if (/from ["']@\/lib\/sync\/claude["']|lib\/sync\/claude/.test(text)) offenders.push(full);
      }
    }
    walk(LIB_DIR);
    walk(APP_DIR);
    expect(offenders).toEqual([]);
  });

  it("the Claude client defaults to the stub and spawns nothing in tests", async () => {
    // With CC_LIVE_AI unset, a run completes without attempting to spawn the claude CLI (which
    // would throw ENOENT in CI). Reaching here with changes proves the stub path ran.
    const run = await runSync({ items: ["kanban"], by: "josh", at: AT });
    expect(run.changes.length).toBeGreaterThan(0);
  });

  it("the Sync engine starts no timer (handoff §8: no scheduled runs)", () => {
    const text = fs.readFileSync(path.join(SYNC_DIR, "engine.ts"), "utf8");
    expect(/setInterval|setTimeout|cron/.test(text)).toBe(false);
  });
});
