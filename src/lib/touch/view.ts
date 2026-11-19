import { todayEastern } from "@/lib/kanban/time";
import { addDays } from "@/lib/ezbinder/dates";
import { eventsOnDate, getLastRefreshAt, type DayEvent } from "@/lib/feeds/store";
import { listPending } from "@/lib/kanban/pending";
import { listCards } from "@/lib/kanban/store";
import { inProgressCards, cardsDueOn } from "@/lib/kanban/view";
import { moneyTiles } from "@/lib/ezbinder/view";
import { usageSummary, weekTokens } from "@/lib/sync/usage";
import { lastRun } from "@/lib/sync/store";
import { buildsView } from "@/lib/builds/view";
import { STAGES } from "@/lib/builds/types";
import type { ProjectCard, BuildsAlerts } from "@/lib/builds/types";
import { BOARDS, type Board } from "@/lib/boards";
import type { Card } from "@/lib/kanban/types";

// The ambient touch screen read model (handoff §6, spec §1, mockups Ambient.dc.html /
// AmbientBuilds.dc.html). It reads exactly the same local data the dashboard uses — no new outside
// call, no AI. Screen 1 (Today) is assembled for all three boards so the on-screen toggle switches
// instantly without a server round-trip (the toggle is client-side; it never persists — spec §3,
// "display only, apart from the toggle and swipe"). Screen 2 (Builds) reuses buildsView().

export type TouchStat = { label: string; value: string; accent: boolean };
export type TouchTodayRow = { id: string; time: string; title: string; sub: string; color: string };
export type TouchDoingRow = { id: string; title: string; area: string; due: string };
export type TouchWaitingRow = { id: string; tag: "Waiting" | "Due"; title: string; when: string };

export type TouchScreen1 = {
  board: Board;
  who: string;
  stats: TouchStat[];
  today: TouchTodayRow[];
  doing: TouchDoingRow[];
  waiting: TouchWaitingRow[];
};

export type TrackerBar = "done" | "current" | "needs" | "todo";
export type TouchProjectRow = {
  repo: string;
  name: string;
  state: string; // Queued | Building | Needs Josh | Landed
  phase: string; // "8 of 10"
  bars: TrackerBar[]; // four, one per stage
  red: boolean; // the row turns red when the build needs Josh (handoff §6)
};
export type TouchUsageBar = {
  key: string;
  label: string;
  value: string;
  pct: number | null;
  hold: boolean;
};
export type TouchActivityRow = { when: string; text: string };
export type TouchScreen2 = {
  usage: TouchUsageBar[];
  projects: TouchProjectRow[];
  activity: TouchActivityRow[];
};

export type TouchBanner = { title: string; detail: string } | null;

export type TouchView = {
  boards: Record<Board, TouchScreen1>;
  builds: TouchScreen2;
  alertKeys: string[]; // stable keys for the active red-alert conditions (new-alert detection)
  banner: TouchBanner;
  initialScreen: 1 | 2;
  lastRefreshedAgo: string;
  lastSyncedAgo: string;
  idleMinutes: number;
};

const WHO: Record<Board, string> = { josh: "Josh", christine: "Christine", bishops: "Bishops" };

// ——— small formatters ———

function timeOfDay(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  let h = Number(m[1]);
  const mm = m[2];
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
}

function clockTime(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
}

export function agoLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "not yet";
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// ——— pure helpers (unit-tested) ———

// Cards due in the coming week for a board: after today, through seven days out. Done/discarded are
// not "due". Today's due cards show in the Today list, so they are excluded here.
export function cardsDueThisWeek(board: Board, today: string, cards: Card[] = listCards()): Card[] {
  const end = addDays(today, 7);
  return cards
    .filter(
      (c) =>
        c.stage !== "done" &&
        c.stage !== "discarded" &&
        c.boards.includes(board) &&
        !!c.due &&
        c.due.slice(0, 10) > today &&
        c.due.slice(0, 10) <= end,
    )
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
}

// Cards blocked on someone else, for a board (the "Waiting on" half of screen 1).
export function waitingOnCards(board: Board, cards: Card[] = listCards()): Card[] {
  return cards
    .filter((c) => c.stage === "waiting_on" && c.boards.includes(board))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// The four-stage tracker bars for a project card (mockup AmbientBuilds `stages`). A landed build
// fills all four grey; otherwise bars before the current stage are done (grey), the current stage is
// highlighted (red when it is Needs Josh), and later stages are not started.
export function trackerBars(card: ProjectCard): TrackerBar[] {
  if (card.stage === "Landed") return ["done", "done", "done", "done"];
  const label = card.stage.startsWith("Queued") ? "Queued" : card.stage;
  const current = Math.max(0, (STAGES as readonly string[]).indexOf(label));
  return STAGES.map((_, i) =>
    i < current ? "done" : i === current ? (i === 2 ? "needs" : "current") : "todo",
  );
}

// The active red-alert conditions and the banner naming them (handoff §6). A build in Needs Josh or
// a failed/rolled-back update is a per-project alert; the budget hold is its own. Each gets a stable
// key so the client can tell a *new* alert (→ jump to screen 2) from one already on screen.
export function touchAlerts(
  projects: ProjectCard[],
  alerts: BuildsAlerts,
): { keys: string[]; banner: TouchBanner } {
  const items: { key: string; label: string }[] = [];
  for (const c of projects) {
    if (c.needsJosh) items.push({ key: `needs:${c.repo}`, label: `${c.name}: answer questions` });
    if (c.rolledBack) {
      items.push({ key: `rollback:${c.repo}`, label: `${c.name}: update failed, rolled back` });
    }
  }
  const keys = items.map((i) => i.key);
  if (alerts.hold) keys.push("hold");

  let banner: TouchBanner = null;
  if (items.length > 0) {
    const n = items.length;
    const lines = items.map((i) => i.label);
    if (alerts.hold) lines.push("Build budget: hold on");
    banner = {
      title: `${n} build${n === 1 ? "" : "s"} ${n === 1 ? "needs" : "need"} you`,
      detail: lines.join(" · "),
    };
  } else if (alerts.hold) {
    banner = {
      title: "Build budget reached, hold on",
      detail: "No new builds start until you override or the week resets",
    };
  }
  return { keys, banner };
}

export function decideInitialScreen(alertKeys: string[]): 1 | 2 {
  return alertKeys.length > 0 ? 2 : 1;
}

// Keys present now that the client has not already reacted to (drives the live jump to screen 2).
export function newAlertKeys(seen: string[], current: string[]): string[] {
  return current.filter((k) => !seen.includes(k));
}

// ——— screen 1 per board ———

function statsFor(board: Board, now: Date, inboxCount: number, today: string): TouchStat[] {
  if (board === "josh") {
    const m = moneyTiles();
    const ar = m?.find((t) => t.label === "Open A/R")?.value ?? "—";
    const recv = m?.find((t) => t.label === "Received this week")?.value ?? "—";
    return [
      { label: "Open A/R", value: ar, accent: false },
      { label: "Received this week", value: recv, accent: false },
      { label: "Inbox to file", value: String(inboxCount), accent: true },
    ];
  }
  const inProgress = inProgressCards(board).length;
  const dueWeek = cardsDueThisWeek(board, today).length;
  const label = board === "christine" ? "Her cards in progress" : "Bishops cards in progress";
  return [
    { label, value: String(inProgress), accent: false },
    { label: "Due this week", value: String(dueWeek), accent: false },
    { label: "Inbox to file", value: String(inboxCount), accent: true },
  ];
}

// Calendar events belong to a person (owner josh | christine). Josh's board shows his events,
// Christine's shows hers, and Bishops (the shared household view) shows all of them.
function eventsForBoard(board: Board, events: DayEvent[]): DayEvent[] {
  if (board === "bishops") return events;
  return events.filter((e) => e.owner === board);
}

function screen1(board: Board, now: Date, events: DayEvent[], inboxCount: number, today: string): TouchScreen1 {
  const todayRows: TouchTodayRow[] = [
    ...eventsForBoard(board, events).map((e) => ({
      id: e.id,
      time: e.allDay ? "All day" : timeOfDay(e.startsAt),
      title: e.title,
      sub: e.location ? `${e.label} · ${e.location}` : e.label,
      color: e.color,
    })),
    ...cardsDueOn(board, today).map((c) => ({
      id: c.id,
      time: "Due",
      title: c.title,
      sub: c.project ? `Kanban · ${c.project}` : "Kanban",
      color: "#FB923C",
    })),
  ];
  const doing: TouchDoingRow[] = inProgressCards(board).map((c) => ({
    id: c.id,
    title: c.title,
    area: cap(c.area),
    due: c.due ? c.due.slice(0, 10) : "",
  }));
  const waiting: TouchWaitingRow[] = [
    ...waitingOnCards(board).map((c) => ({
      id: c.id,
      tag: "Waiting" as const,
      title: c.waiting_on ? `${c.title} — ${c.waiting_on}` : c.title,
      when: c.waiting_since ? c.waiting_since.slice(0, 10) : "",
    })),
    ...cardsDueThisWeek(board, today).map((c) => ({
      id: c.id,
      tag: "Due" as const,
      title: c.title,
      when: (c.due ?? "").slice(0, 10),
    })),
  ];
  return { board, who: WHO[board], stats: statsFor(board, now, inboxCount, today), today: todayRows, doing, waiting };
}

// ——— screen 2 (builds) ———

function usageBars(now: Date, budgetPct: number | null, hold: boolean): TouchUsageBar[] {
  const plan = usageSummary(now).planPct;
  const week = weekTokens(now);
  return [
    { key: "plan", label: "Weekly plan", value: plan === null ? "—" : `${plan}%`, pct: plan, hold: false },
    { key: "fable", label: "Fable weekly", value: "—", pct: null, hold: false },
    {
      key: "budget",
      label: "Build budget",
      value: hold ? "HOLD" : budgetPct === null ? "—" : `${budgetPct}%`,
      pct: budgetPct,
      hold,
    },
    { key: "dashboard", label: "Dashboard", value: `${fmtTokens(week)} tok`, pct: null, hold: false },
  ];
}

function projectRows(projects: ProjectCard[]): TouchProjectRow[] {
  return projects.map((c) => {
    const pos = c.current?.position ?? c.landedCount;
    const state = c.stage.startsWith("Queued") ? "Queued" : c.stage;
    return {
      repo: c.repo,
      name: c.name,
      state,
      phase: `${pos} of ${c.totalCount}`,
      bars: trackerBars(c),
      red: c.needsJosh,
    };
  });
}

// ——— assembly ———

export function touchView(now: Date = new Date(), idleMinutes: number): TouchView {
  const today = todayEastern(now);
  const events = eventsOnDate(today);
  const inboxCount = listPending().length;
  const bv = buildsView(now);
  const { keys, banner } = touchAlerts(bv.projects, bv.alerts);

  const boards = {} as Record<Board, TouchScreen1>;
  for (const b of BOARDS) boards[b] = screen1(b, now, events, inboxCount, today);

  const last = lastRun();
  return {
    boards,
    builds: {
      usage: usageBars(now, bv.budget.pct, bv.budget.hold),
      projects: projectRows(bv.projects),
      activity: bv.activity.map((a) => ({ when: a.at ? clockTime(a.at) : "now", text: a.text })),
    },
    alertKeys: keys,
    banner,
    initialScreen: decideInitialScreen(keys),
    lastRefreshedAgo: agoLabel(getLastRefreshAt(), now),
    lastSyncedAgo: agoLabel(last?.finishedAt ?? null, now),
    idleMinutes,
  };
}
