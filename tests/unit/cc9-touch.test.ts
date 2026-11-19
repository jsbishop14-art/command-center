import { describe, it, expect, beforeEach } from "vitest";
import { useTempDb, useTempKanban, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { ensureLayout } from "../../src/lib/kanban/store";
import { reconcile } from "../../src/lib/kanban/reconciler";
import { addCard } from "../../src/lib/kanban/actions-layer";
import { ensureBuildsStub } from "../../src/lib/builds/stub";
import { saveArSummary } from "../../src/lib/ezbinder/store";
import { todayEastern, nowEastern } from "../../src/lib/kanban/time";
import { addDays } from "../../src/lib/ezbinder/dates";
import {
  getTouchIdleMinutes,
  setTouchIdleMinutes,
  DEFAULT_IDLE_MINUTES,
  MIN_IDLE_MINUTES,
  MAX_IDLE_MINUTES,
} from "../../src/lib/touch/settings";
import {
  touchView,
  trackerBars,
  touchAlerts,
  decideInitialScreen,
  newAlertKeys,
  cardsDueThisWeek,
  waitingOnCards,
  agoLabel,
  type TrackerBar,
} from "../../src/lib/touch/view";
import type { ProjectCard, BuildsAlerts } from "../../src/lib/builds/types";

// CC9 — the ambient touch screen (handoff §6, spec §1/§4). All data is the same local data the
// dashboard uses, read against the GitHub stub seeded on first read; no real outside call, no AI.

function fresh() {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  delete process.env.CC_LIVE_GITHUB;
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureLayout();
  reconcile();
}

// A minimal ProjectCard for the pure-helper tests.
function card(over: Partial<ProjectCard>): ProjectCard {
  return {
    name: "X",
    repo: "x",
    landedCount: 0,
    totalCount: 3,
    current: null,
    stage: "Queued",
    queueLabel: "",
    lastLanded: null,
    lastActivityAt: null,
    noActivityHours: null,
    needsJosh: false,
    unansweredCount: 0,
    answersSaved: false,
    runnerCommand: null,
    live: null,
    rolledBack: null,
    ...over,
  };
}

const NO_ALERTS: BuildsAlerts = { needsJosh: 0, bell: 0, hold: false, warn: false, rolledBack: false };

describe("CC9 idle-time setting (handoff §6: editable, default 3 min)", () => {
  beforeEach(fresh);

  it("defaults to 3 minutes when unset", () => {
    expect(getTouchIdleMinutes()).toBe(DEFAULT_IDLE_MINUTES);
    expect(DEFAULT_IDLE_MINUTES).toBe(3);
  });

  it("persists a set value and clamps out-of-range values", () => {
    expect(setTouchIdleMinutes(10)).toBe(10);
    expect(getTouchIdleMinutes()).toBe(10);
    expect(setTouchIdleMinutes(0)).toBe(MIN_IDLE_MINUTES);
    expect(getTouchIdleMinutes()).toBe(MIN_IDLE_MINUTES);
    expect(setTouchIdleMinutes(9999)).toBe(MAX_IDLE_MINUTES);
    expect(getTouchIdleMinutes()).toBe(MAX_IDLE_MINUTES);
  });

  it("rejects a non-number", () => {
    expect(() => setTouchIdleMinutes(Number.NaN)).toThrow();
  });
});

describe("CC9 tracker bars (mockup AmbientBuilds stages)", () => {
  it("a landed build fills all four grey", () => {
    expect(trackerBars(card({ stage: "Landed" }))).toEqual<TrackerBar[]>(["done", "done", "done", "done"]);
  });
  it("Building highlights the second stage", () => {
    expect(trackerBars(card({ stage: "Building" }))).toEqual<TrackerBar[]>(["done", "current", "todo", "todo"]);
  });
  it("Needs Josh highlights the third stage in red", () => {
    expect(trackerBars(card({ stage: "Needs Josh" }))).toEqual<TrackerBar[]>(["done", "done", "needs", "todo"]);
  });
  it("Queued (even held by budget) highlights the first stage", () => {
    expect(trackerBars(card({ stage: "Queued" }))).toEqual<TrackerBar[]>(["current", "todo", "todo", "todo"]);
    expect(trackerBars(card({ stage: "Queued · held by budget" }))).toEqual<TrackerBar[]>([
      "current",
      "todo",
      "todo",
      "todo",
    ]);
  });
});

describe("CC9 alerts and the jump decision (spec §4 check 2)", () => {
  it("no alert → start on screen 1, no banner", () => {
    const { keys, banner } = touchAlerts([card({})], NO_ALERTS);
    expect(keys).toEqual([]);
    expect(banner).toBeNull();
    expect(decideInitialScreen(keys)).toBe(1);
  });

  it("a Needs-Josh build → key, banner naming it, screen 2", () => {
    const projects = [card({ name: "EZ Binder API", repo: "ez-binder", stage: "Needs Josh", needsJosh: true })];
    const { keys, banner } = touchAlerts(projects, { ...NO_ALERTS, needsJosh: 1, bell: 1 });
    expect(keys).toEqual(["needs:ez-binder"]);
    expect(banner?.title).toBe("1 build needs you");
    expect(banner?.detail).toContain("EZ Binder API: answer questions");
    expect(decideInitialScreen(keys)).toBe(2);
  });

  it("the budget hold alone → hold key and its banner, screen 2", () => {
    const { keys, banner } = touchAlerts([card({})], { ...NO_ALERTS, hold: true, bell: 1 });
    expect(keys).toEqual(["hold"]);
    expect(banner?.title).toBe("Build budget reached, hold on");
    expect(decideInitialScreen(keys)).toBe(2);
  });

  it("a failed/rolled-back update → key and banner naming it", () => {
    const projects = [
      card({ name: "Command Center", repo: "command-center", rolledBack: { at: "2026-11-18 10:00", message: "x", log: "y" } }),
    ];
    const { keys, banner } = touchAlerts(projects, { ...NO_ALERTS, needsJosh: 1, bell: 1, rolledBack: true });
    expect(keys).toEqual(["rollback:command-center"]);
    expect(banner?.detail).toContain("Command Center: update failed, rolled back");
    expect(decideInitialScreen(keys)).toBe(2);
  });

  it("newAlertKeys returns only keys not already seen", () => {
    expect(newAlertKeys(["hold"], ["hold", "needs:ez-binder"])).toEqual(["needs:ez-binder"]);
    expect(newAlertKeys(["hold"], ["hold"])).toEqual([]);
    expect(newAlertKeys([], ["needs:a", "hold"])).toEqual(["needs:a", "hold"]);
  });
});

describe("CC9 ago label", () => {
  it("formats null, minutes, hours and days", () => {
    const now = new Date("2026-11-19T12:00:00-05:00");
    expect(agoLabel(null, now)).toBe("not yet");
    expect(agoLabel("2026-11-19T11:30:00-05:00", now)).toBe("30m ago");
    expect(agoLabel("2026-11-19T09:00:00-05:00", now)).toBe("3h ago");
    expect(agoLabel("2026-11-17T12:00:00-05:00", now)).toBe("2d ago");
  });
});

describe("CC9 board-scoped kanban helpers", () => {
  beforeEach(fresh);

  it("cardsDueThisWeek excludes today and done, keeps the next seven days, board-scoped", () => {
    const at = nowEastern();
    const today = todayEastern();
    addCard("josh", { title: "Due today", stage: "next", boards: ["josh"], area: "business", due: today }, { at });
    addCard("josh", { title: "Due in 3 days", stage: "next", boards: ["josh"], area: "business", due: addDays(today, 3) }, { at });
    addCard("josh", { title: "Due in 10 days", stage: "next", boards: ["josh"], area: "business", due: addDays(today, 10) }, { at });
    addCard("christine", { title: "Hers in 2 days", stage: "next", boards: ["christine"], area: "family", due: addDays(today, 2) }, { at });

    const josh = cardsDueThisWeek("josh", today).map((c) => c.title);
    expect(josh).toEqual(["Due in 3 days"]);
    const chris = cardsDueThisWeek("christine", today).map((c) => c.title);
    expect(chris).toEqual(["Hers in 2 days"]);
  });

  it("waitingOnCards returns waiting_on cards for the board only", () => {
    const at = nowEastern();
    addCard("josh", { title: "Waiting on sub", stage: "waiting_on", boards: ["josh"], area: "business" }, { at });
    addCard("christine", { title: "Waiting on vendor", stage: "waiting_on", boards: ["christine"], area: "family" }, { at });
    expect(waitingOnCards("josh").map((c) => c.title)).toEqual(["Waiting on sub"]);
    expect(waitingOnCards("christine").map((c) => c.title)).toEqual(["Waiting on vendor"]);
    expect(waitingOnCards("bishops")).toEqual([]);
  });
});

describe("CC9 touchView against the GitHub stub (spec §4 checks 2 and 3)", () => {
  beforeEach(() => {
    fresh();
    ensureBuildsStub();
  });

  it("starts on screen 2 because a build needs Josh and the budget hold is on", () => {
    const v = touchView(new Date(), 3);
    expect(v.initialScreen).toBe(2);
    expect(v.alertKeys).toContain("needs:ez-binder");
    expect(v.alertKeys).toContain("hold");
    expect(v.banner).not.toBeNull();
    expect(v.banner?.detail).toContain("EZ Binder API: answer questions");
    expect(v.banner?.detail).toContain("Build budget: hold on");
    expect(v.idleMinutes).toBe(3);
  });

  it("the builds screen has a HOLD budget bar, a landed project and a red Needs-Josh row", () => {
    const v = touchView(new Date(), 3);
    const budget = v.builds.usage.find((u) => u.key === "budget");
    expect(budget?.hold).toBe(true);
    expect(budget?.value).toBe("HOLD");

    const ezDraft = v.builds.projects.find((p) => p.repo === "ez-draft");
    expect(ezDraft?.state).toBe("Landed");
    expect(ezDraft?.bars).toEqual<TrackerBar[]>(["done", "done", "done", "done"]);

    const ezb = v.builds.projects.find((p) => p.repo === "ez-binder");
    expect(ezb?.state).toBe("Needs Josh");
    expect(ezb?.red).toBe(true);
    expect(ezb?.bars[2]).toBe("needs");
    // "place in the chain" label (handoff §6: e.g. "3 of 10").
    expect(ezb?.phase).toMatch(/^\d+ of \d+$/);
  });

  it("screen 1 is built for all three boards with the right stats shape", () => {
    const v = touchView(new Date(), 3);
    expect(Object.keys(v.boards).sort()).toEqual(["bishops", "christine", "josh"]);
    // Josh: money stats (no EZ Binder data seeded yet → em dash), plus inbox.
    expect(v.boards.josh.stats.map((s) => s.label)).toEqual(["Open A/R", "Received this week", "Inbox to file"]);
    expect(v.boards.josh.stats[0].value).toBe("—");
    // Christine/Bishops: card-count stats.
    expect(v.boards.christine.stats[0].label).toBe("Her cards in progress");
    expect(v.boards.bishops.stats[0].label).toBe("Bishops cards in progress");
    expect(v.boards.christine.who).toBe("Christine");
  });

  it("Josh's money stats show EZ Binder figures once a summary is cached", () => {
    saveArSummary(
      { openArCents: 1234500, receivedThisWeekCents: 50000, openInvoiceCount: 3, over30Cents: 0, asOf: "2026-11-19T00:00:00-05:00" },
      nowEastern(),
    );
    const v = touchView(new Date(), 3);
    expect(v.boards.josh.stats[0].value).toBe("$12,345.00");
    expect(v.boards.josh.stats[1].value).toBe("$500.00");
  });
});
