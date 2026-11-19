import { todayEastern } from "@/lib/kanban/time";
import { getArSummary, listJobs, listTasks } from "./store";
import { openProposals, type Proposal } from "./proposals";
import { weekdays, daysFrom } from "./dates";
import type { EzbJob, EzbTask } from "./types";

// Read-side helpers for the money tiles (handoff §2 item 1) and the GC schedule grid (handoff §2
// item 4, mockup Main.dc.html). All data comes from the local cache the sync and webhook fill, so
// Home renders without any outside call. No AI.

const GRID_DAYS = 10; // ten weekday columns across the next two weeks (mockup)

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type MoneyTile = { label: string; value: string; src: string };

// The four money tiles, to the cent (spec check 1). Null until the first sync fills ezb_money; the
// page then shows "Waiting on EZ Binder" instead.
export function moneyTiles(): MoneyTile[] | null {
  const m = getArSummary();
  if (!m) return null;
  return [
    { label: "Open A/R", value: formatCents(m.openArCents), src: "EZ Binder · invoices" },
    { label: "Received this week", value: formatCents(m.receivedThisWeekCents), src: "EZ Binder · payments" },
    { label: "Open invoices", value: String(m.openInvoiceCount), src: "EZ Binder · invoices" },
    { label: "Over 30 days", value: formatCents(m.over30Cents), src: "EZ Binder · invoices" },
  ];
}

export type ScheduleDay = { label: string; date: string; isToday: boolean };
export type ScheduleBar = {
  key: string;
  title: string;
  gridColumn: string;
  kind: "task" | "inspection" | "mobilize" | "proposal";
  source?: "josh" | "rule" | "claude";
};
export type ScheduleRow = { jobId: string; job: string; dot: string; bars: ScheduleBar[] };
export type ScheduleGrid = { days: ScheduleDay[]; rows: ScheduleRow[]; hasData: boolean };

const PHASE_DOT: Record<string, string> = { active: "#15803D", sold_not_started: "#B45309", punch: "#5B606B" };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const g = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${DOW[g]} ${m}/${d}`;
}

// Map a date range to a grid-column span over the day columns, or null if it falls entirely outside
// the visible window. Day column d (0-based) sits at CSS grid column d + 2 (column 1 is the job
// label). A range that starts before the window is clamped to the first column; one that ends after
// it is clamped to the last.
function spanFor(startsOn: string, endsOn: string, days: ScheduleDay[]): string | null {
  const first = days[0].date;
  const last = days[days.length - 1].date;
  if (endsOn < first || startsOn > last) return null;
  const startIdx = Math.max(0, days.findIndex((dd) => dd.date >= startsOn));
  let endIdx = days.findIndex((dd) => dd.date >= endsOn);
  if (endIdx === -1) endIdx = days.length - 1;
  const span = Math.max(1, endIdx - startIdx + 1);
  return `${startIdx + 2} / span ${span}`;
}

export function scheduleGrid(opts?: { today?: string }): ScheduleGrid {
  const today = opts?.today ?? todayEastern();
  const days: ScheduleDay[] = weekdays(today, GRID_DAYS).map((date) => ({
    label: dayLabel(date),
    date,
    isToday: date === today,
  }));

  // Only active and sold-not-started jobs appear on the schedule (handoff §2 item 4).
  const jobs = listJobs().filter((j) => j.phase === "active" || j.phase === "sold_not_started");
  const tasksByJob = new Map<string, EzbTask[]>();
  for (const t of listTasks()) {
    const arr = tasksByJob.get(t.jobId) ?? [];
    arr.push(t);
    tasksByJob.set(t.jobId, arr);
  }
  const propsByJob = new Map<string, Proposal[]>();
  for (const p of openProposals()) {
    const arr = propsByJob.get(p.jobId) ?? [];
    arr.push(p);
    propsByJob.set(p.jobId, arr);
  }

  const rows: ScheduleRow[] = jobs.map((j: EzbJob) => {
    const bars: ScheduleBar[] = [];
    for (const t of tasksByJob.get(j.jobId) ?? []) {
      const gc = spanFor(t.startsOn, t.endsOn, days);
      if (gc) bars.push({ key: `t-${t.taskId}`, title: t.name, gridColumn: gc, kind: t.kind });
    }
    for (const p of propsByJob.get(j.jobId) ?? []) {
      const gc = spanFor(p.toStart, p.toEnd, days);
      if (gc)
        bars.push({
          key: `p-${p.id}`,
          title: `Proposed by ${sourceLabel(p.source)} · confirm in EZ Binder`,
          gridColumn: gc,
          kind: "proposal",
          source: p.source,
        });
    }
    return { jobId: j.jobId, job: j.name, dot: PHASE_DOT[j.phase] ?? "#5B606B", bars };
  });

  return { days, rows, hasData: jobs.length > 0 };
}

function sourceLabel(s: "josh" | "rule" | "claude"): string {
  return s === "josh" ? "Josh" : s === "rule" ? "rule" : "Claude";
}

// Money string for a GC job card in Projects (handoff §2: "Money = billed/paid from EZ Binder").
export function jobMoney(j: EzbJob): string {
  return `${formatCents(j.billedCents)} billed / ${formatCents(j.paidCents)} paid`;
}

// A proposal's human line for the schedule list beneath the grid, newest first.
export type ProposalLine = { id: number; source: "josh" | "rule" | "claude"; text: string; note: string };
export function proposalLines(): ProposalLine[] {
  return openProposals()
    .map((p) => ({
      id: p.id,
      source: p.source,
      text: `Proposed by ${sourceLabel(p.source)} · ${p.toStart} → ${p.toEnd}`,
      note: p.note,
    }))
    .reverse();
}

export const daysPastEnd = daysFrom; // re-exported for tests of the slip window
