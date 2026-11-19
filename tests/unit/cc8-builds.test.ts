import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb, useTempKanban, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import {
  readFile,
  listCommits,
  commit,
  isAllowedWrite,
  DisallowedWriteError,
  BUILD_CONTROL_REPO,
} from "../../src/lib/builds/github";
import { ensureBuildsStub } from "../../src/lib/builds/stub";
import { listProjects, setProjects } from "../../src/lib/builds/projects";
import { budgetState, usedThisWeek, weekResetWall, nextResetStamp } from "../../src/lib/builds/budget";
import { deriveProject, parseQuestions, parsePickUpHere, runnerCommand, statusPath } from "../../src/lib/builds/state";
import { commitAnswer, commitBudget, insertAnswerLine, AnswerError } from "../../src/lib/builds/writer";
import { buildsView, buildsAlerts } from "../../src/lib/builds/view";

// CC8 — Builds screen, build questions and the build budget (spec §4 = handoff §11 "Builds", minus
// the touch-screen checks which are CC9). Everything runs against the GitHub stub: no real GitHub
// read or write in CI or build sessions (spec §6; CLAUDE §3). No AI anywhere.

function fresh() {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  delete process.env.CC_LIVE_GITHUB;
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureBuildsStub();
}

function cardFor(repo: string) {
  const project = listProjects().find((p) => p.repo === repo)!;
  return deriveProject(project, budgetState());
}

describe("CC8 stage derivation (handoff §7.1, check 1)", () => {
  beforeEach(fresh);

  it("gives each project the right stage from GitHub", () => {
    expect(cardFor("command-center").stage).toBe("Building");
    expect(cardFor("ez-binder").stage).toBe("Needs Josh");
    expect(cardFor("ez-draft").stage).toBe("Landed");
    // Budget is over its limit in the stub → the hold is on, so no queued build can start: every
    // all-queued project shows "held by budget" (process.md §12: "no new build session starts").
    expect(cardFor("frame-focus").stage).toBe("Queued · held by budget");
    expect(cardFor("popcorn-pilot").stage).toBe("Queued · held by budget");
  });

  it("a queued project reads plain 'Queued' once the hold is cleared", () => {
    commitBudget({ weeklyLimitTokens: 100_000_000 }, "Josh"); // well above this week's usage
    expect(cardFor("frame-focus").stage).toBe("Queued");
    expect(cardFor("frame-focus").current?.heldByBudget).toBe(false);
  });

  it("Needs Josh when the status file has an unanswered question; Building otherwise", () => {
    const ez = cardFor("ez-binder");
    expect(ez.needsJosh).toBe(true);
    expect(ez.unansweredCount).toBe(2);
    const bp = cardFor("blueprint-creator");
    expect(bp.needsJosh).toBe(false);
    expect(bp.answersSaved).toBe(true); // all questions answered, waiting for the runner
    expect(bp.runnerCommand).toContain("run_chain.py");
  });

  it("counts landed builds, place in the chain and the last landing", () => {
    const cc = cardFor("command-center");
    expect(cc.landedCount).toBe(7);
    expect(cc.totalCount).toBe(10);
    expect(cc.queueLabel).toBe("7 of 10 builds landed");
    const ed = cardFor("ez-draft");
    expect(ed.lastLanded?.name).toBe("ED2");
  });

  it("marks a Building project with no commit for 3h+ as amber", () => {
    // Age the CC8 branch commit to 5 hours ago.
    getDb()
      .prepare("UPDATE builds_commits SET committed_at = ? WHERE repo = 'command-center' AND branch = 'cc8-builds'")
      .run(new Date(Date.now() - 5 * 3600_000).toISOString());
    const cc = cardFor("command-center");
    expect(cc.noActivityHours).not.toBeNull();
    expect(cc.noActivityHours!).toBeGreaterThanOrEqual(3);
  });
});

describe("CC8 question parsing (process.md §5 shape)", () => {
  beforeEach(fresh);

  it("parses questions, options, recommendation and PICK UP HERE", () => {
    const status = readFile("ez-binder", "s157-changes-feed", statusPath("S157"))!;
    expect(parsePickUpHere(status)).toContain("cursor");
    const qs = parseQuestions(status);
    expect(qs.length).toBe(2);
    expect(qs[0].id).toBe("S157-ASK-1");
    expect(qs[0].options.map((o) => o.key)).toEqual(["A", "B"]);
    expect(qs[0].recommendation).toContain("opaque cursor");
    expect(qs[0].answer).toBeNull();
    expect(qs[1].options.length).toBe(3);
  });

  it("reads an existing Answer line back", () => {
    const status = readFile("blueprint-creator", "bp2-layers", statusPath("BP2"))!;
    const qs = parseQuestions(status);
    expect(qs[0].answer).not.toBeNull();
    expect(qs[0].answer!.by).toBe("josh");
    expect(qs[0].answer!.text).toBe("B");
  });
});

describe("CC8 answer flow (handoff §7.1, check 3)", () => {
  beforeEach(fresh);

  it("writes the answer verbatim with the time and changes chain.md in the same [skip ci] commit", () => {
    const c = commitAnswer({
      repo: "ez-binder",
      branch: "s157-changes-feed",
      buildName: "S157",
      questionId: "S157-ASK-1",
      questionNumber: 1,
      by: "Josh",
      at: "2026-11-19 10:00",
      answer: "A",
    });
    // One commit, [skip ci], touching exactly the status file and chain.md.
    expect(c.message).toContain("[skip ci]");
    expect(c.paths.sort()).toEqual(["docs/claude/chain.md", "docs/sessions/S157-status.md"]);

    const status = readFile("ez-binder", "s157-changes-feed", statusPath("S157"))!;
    expect(status).toContain('Answer — Josh, 2026-11-19 10:00 (verbatim): "A"');

    const chain = readFile("ez-binder", "s157-changes-feed", "docs/claude/chain.md")!;
    expect(chain).toContain("[S157-ASK-1]");
    expect(chain).toContain('"A"');

    // The question now reads as answered; the first question is gone from the unanswered set.
    const qs = parseQuestions(status);
    expect(qs.find((q) => q.id === "S157-ASK-1")!.answer!.text).toBe("A");
    expect(qs.filter((q) => q.answer === null).length).toBe(1);
  });

  it("shows the runner command once the last question is answered", () => {
    for (const id of ["S157-ASK-1", "S157-ASK-2"]) {
      commitAnswer({
        repo: "ez-binder",
        branch: "s157-changes-feed",
        buildName: "S157",
        questionId: id,
        questionNumber: Number(id.slice(-1)),
        by: "Josh",
        at: "2026-11-19 10:05",
        answer: "A",
      });
    }
    const card = cardFor("ez-binder");
    expect(card.needsJosh).toBe(false);
    expect(card.answersSaved).toBe(true);
    expect(card.runnerCommand).toContain("python3 ~/run_chain.py");
  });

  it("refuses to answer a question twice", () => {
    commitAnswer({
      repo: "ez-binder", branch: "s157-changes-feed", buildName: "S157",
      questionId: "S157-ASK-1", questionNumber: 1, by: "Josh", at: "2026-11-19 10:00", answer: "A",
    });
    expect(() =>
      commitAnswer({
        repo: "ez-binder", branch: "s157-changes-feed", buildName: "S157",
        questionId: "S157-ASK-1", questionNumber: 1, by: "Josh", at: "2026-11-19 10:01", answer: "B",
      }),
    ).toThrow(AnswerError);
  });

  it("inserts the answer directly under the recommendation", () => {
    const status = readFile("ez-binder", "s157-changes-feed", statusPath("S157"))!;
    const out = insertAnswerLine(status, {
      repo: "ez-binder", branch: "s157-changes-feed", buildName: "S157",
      questionId: "S157-ASK-1", questionNumber: 1, by: "Josh", at: "2026-11-19 10:00", answer: "A",
    });
    const lines = out.split("\n");
    const recIdx = lines.findIndex((l) => l.startsWith("My recommendation: A — an opaque"));
    expect(lines[recIdx + 1]).toContain('Answer — Josh, 2026-11-19 10:00 (verbatim): "A"');
  });
});

describe("CC8 write allowlist (spec §3, check 4)", () => {
  beforeEach(fresh);

  it("allows only status files + chain.md on build branches and budget.json on build-control", () => {
    expect(isAllowedWrite("ez-binder", "s157-changes-feed", "docs/sessions/S157-status.md")).toBe(true);
    expect(isAllowedWrite("ez-binder", "s157-changes-feed", "docs/claude/chain.md")).toBe(true);
    expect(isAllowedWrite(BUILD_CONTROL_REPO, "main", "budget.json")).toBe(true);
    // Refused:
    expect(isAllowedWrite("ez-binder", "main", "docs/sessions/S157-status.md")).toBe(false); // not a build branch
    expect(isAllowedWrite("ez-binder", "s157-changes-feed", "src/index.ts")).toBe(false); // other file
    expect(isAllowedWrite("ez-binder", "docs/next-builds", "docs/claude/chain.md")).toBe(false); // chain branch
    expect(isAllowedWrite(BUILD_CONTROL_REPO, "main", "usage.jsonl")).toBe(false); // app never writes usage
    expect(isAllowedWrite("command-center", "cc8-builds", "README.md")).toBe(false);
  });

  it("commit() throws on any disallowed path", () => {
    expect(() =>
      commit("ez-binder", "s157-changes-feed", [{ path: "src/evil.ts", content: "x" }], "m [skip ci]", "Josh"),
    ).toThrow(DisallowedWriteError);
    // A disallowed path alongside an allowed one still refuses the whole commit.
    expect(() =>
      commit(
        "ez-binder",
        "s157-changes-feed",
        [
          { path: "docs/sessions/S157-status.md", content: "x" },
          { path: "package.json", content: "x" },
        ],
        "m [skip ci]",
        "Josh",
      ),
    ).toThrow(DisallowedWriteError);
  });

  it("every commit the app records touches only allowed paths", () => {
    commitAnswer({
      repo: "ez-binder", branch: "s157-changes-feed", buildName: "S157",
      questionId: "S157-ASK-1", questionNumber: 1, by: "Josh", at: "2026-11-19 10:00", answer: "A",
    });
    commitBudget({ weeklyLimitTokens: 50_000_000 }, "Josh");
    const rows = getDb()
      .prepare("SELECT repo, branch, paths FROM builds_commits WHERE author = 'Josh'")
      .all() as { repo: string; branch: string; paths: string }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      for (const p of JSON.parse(r.paths) as string[]) {
        expect(isAllowedWrite(r.repo, r.branch, p)).toBe(true);
      }
    }
  });
});

describe("CC8 build budget (process.md §12, check 5)", () => {
  beforeEach(fresh);

  it("sums this week's usage.jsonl and holds over the limit", () => {
    const b = budgetState();
    expect(b.configured).toBe(true);
    expect(b.usedThisWeek).toBe(40_700_000); // 12M + 9.5M + 11M + 8.2M this week
    expect(b.limit).toBe(40_000_000);
    expect(b.hold).toBe(true);
    expect(b.pct).toBeGreaterThanOrEqual(100);
  });

  it("an override clears the hold and the next runner start proceeds", () => {
    commitBudget({ overrideUntil: nextResetStamp() }, "Josh");
    const b = budgetState();
    expect(b.overrideActive).toBe(true);
    expect(b.hold).toBe(false);
  });

  it("a limit above this week's usage warns but does not hold", () => {
    commitBudget({ weeklyLimitTokens: 60_000_000, warnPct: 60 }, "Josh");
    const b = budgetState();
    expect(b.hold).toBe(false);
    expect(b.warn).toBe(true); // 40.7M of 60M is over 60%
  });

  it("shows 'Budget not set up' when build-control has no budget.json", () => {
    getDb().prepare("DELETE FROM builds_files WHERE repo = ? AND path = 'budget.json'").run(BUILD_CONTROL_REPO);
    expect(budgetState().configured).toBe(false);
  });

  it("only counts usage since the Monday 2:00 AM reset", () => {
    const reset = weekResetWall(new Date("2026-11-19T12:00:00-05:00")); // a Thursday
    expect(reset).toBe("2026-11-16T02:00:00"); // the Monday of that week
    // An entry just before the reset is excluded; one just after is included.
    getDb()
      .prepare("UPDATE builds_files SET content = ? WHERE repo = ? AND path = 'usage.jsonl'")
      .run(
        [
          JSON.stringify({ at: "2026-11-16T01:00:00-05:00", tokens: 5_000_000 }), // before reset
          JSON.stringify({ at: "2026-11-16T03:00:00-05:00", tokens: 1_000_000 }), // after reset
        ].join("\n"),
        BUILD_CONTROL_REPO,
      );
    expect(usedThisWeek(new Date("2026-11-19T12:00:00-05:00"))).toBe(1_000_000);
  });
});

describe("CC8 projects, runner command, alerts (handoff §7.1)", () => {
  beforeEach(fresh);

  it("lists the six default projects and lets Josh edit the list", () => {
    expect(listProjects().length).toBe(6);
    setProjects([{ name: "Just One", repo: "owner/just-one" }]);
    expect(listProjects()).toEqual([{ name: "Just One", repo: "owner/just-one" }]);
  });

  it("builds the runner command from process.md §2", () => {
    expect(runnerCommand("owner/ez-binder")).toBe(
      "cd ez-binder && git fetch -q origin docs/next-builds && " +
        "git show origin/docs/next-builds:scripts/run_chain.py > ~/run_chain.py && python3 ~/run_chain.py",
    );
  });

  it("the red Builds badge counts Needs-Josh projects; the bell adds the hold", () => {
    const a = buildsAlerts();
    expect(a.needsJosh).toBe(1); // only EZ Binder has an unanswered question
    expect(a.hold).toBe(true);
    expect(a.bell).toBe(2); // 1 needs-Josh + 1 hold
  });

  it("assembles the whole view without an outside call", () => {
    const v = buildsView();
    expect(v.projects.length).toBe(6);
    expect(v.needsYou.some((n) => n.kind === "questions")).toBe(true);
    expect(v.needsYou.some((n) => n.kind === "answers-saved")).toBe(true);
    // CC8 Building + S157 Needs Josh + BP2 (answers saved, still Building).
    expect(v.usage.find((u) => u.key === "inprogress")?.value).toBe("3");
  });
});

describe("CC8 updater display (handoff §7.4 steps 7-8)", () => {
  beforeEach(fresh);

  it("shows Live on Mac mini and a rollback alert from the local updater files", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-upd-"));
    const live = listCommits("command-center", "main")[0].sha;
    fs.writeFileSync(path.join(dir, "updater-state.json"), JSON.stringify({ liveMerge: live }));
    const alerts = path.join(dir, "alerts");
    fs.mkdirSync(alerts);
    fs.writeFileSync(
      path.join(alerts, "2026-11-19.json"),
      JSON.stringify({ at: "2026-11-19T08:00:00-05:00", message: "Update failed, rolled back", log: "smoke: home did not load" }),
    );
    process.env.CC_UPDATER_STATE = path.join(dir, "updater-state.json");
    process.env.CC_ALERT_DIR = alerts;
    try {
      // buildsView wires updaterView for the Command Center card (deriveAll).
      const cc = buildsView().projects.find((p) => p.repo === "command-center")!;
      expect(cc.live?.merge).toBe(live);
      expect(cc.rolledBack?.message).toContain("rolled back");
    } finally {
      delete process.env.CC_UPDATER_STATE;
      delete process.env.CC_ALERT_DIR;
    }
  });
});
