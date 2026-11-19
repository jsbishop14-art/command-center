import { todayEastern } from "@/lib/kanban/time";
import { addDays } from "./dates";
import type {
  ArSummary,
  Changes,
  EstimateInfo,
  ActiveClient,
  EzbJob,
  EzbTask,
  ProposalReceipt,
  ProposalRequest,
  Schedule,
} from "./types";

// The EZ Binder stub, built from the S156 contract as described in the handoff (spec §2: "Everything
// against a stub built from the S156 contract until Josh confirms S156 is live"). It is the single
// source for CI, build sessions and local dev — no real outside call is ever made here (handoff
// §7.5, CLAUDE §3). Schedule dates are generated relative to today so the two-week grid always has
// bars to show, and the slip rule has one overrunning task to act on. No AI.

// GET /summary/ar. Whole cents, so the tiles match EZ Binder to the cent (spec check 1).
export function stubArSummary(asOf: string): ArSummary {
  return {
    openArCents: 24_318_742, // $243,187.42
    receivedThisWeekCents: 4_200_000, // $42,000.00
    openInvoiceCount: 7,
    over30Cents: 9_865_010, // $98,650.10
    asOf,
  };
}

// GC jobs. billed/paid in whole cents. Punch jobs appear in Projects but not on the schedule grid
// (handoff §2 item 4: "active and sold-not-started jobs"). updatedAt is fixed per job so a
// newest-wins comparison is deterministic in tests.
export function stubJobs(): EzbJob[] {
  return [
    {
      jobId: "JOB-5521",
      name: "Riverwood pool house",
      phase: "active",
      nowTask: "Framing inspection",
      nextTask: "Rough electrical",
      due: addDays(todayEastern(), 15),
      billedCents: 18_450_000,
      paidCents: 12_000_000,
      boards: ["josh"],
      updatedAt: "2026-11-18T09:00:00-05:00",
    },
    {
      jobId: "JOB-5530",
      name: "Garcia pool deck",
      phase: "sold_not_started",
      nowTask: "Awaiting permit",
      nextTask: "Demo",
      due: addDays(todayEastern(), 20),
      billedCents: 5_230_000,
      paidCents: 0,
      boards: ["josh"],
      updatedAt: "2026-11-17T14:30:00-05:00",
    },
    {
      jobId: "JOB-5490",
      name: "Maple St kitchen",
      phase: "punch",
      nowTask: "Punch list",
      nextTask: "Final walk-through",
      due: addDays(todayEastern(), 7),
      billedCents: 9_600_000,
      paidCents: 9_000_000,
      boards: ["josh"],
      updatedAt: "2026-11-16T11:15:00-05:00",
    },
  ];
}

// Schedule tasks, generated relative to today. Riverwood's "Framing" ends two days ago and is not
// completed, so the slip rule (handoff §2.2) has exactly one overrunning task to propose a shift
// for. All other tasks are in the two-week window ahead.
export function stubTasks(): EzbTask[] {
  const t = todayEastern();
  const upd = "2026-11-18T09:00:00-05:00";
  return [
    { taskId: "T-5521-1", jobId: "JOB-5521", name: "Framing", startsOn: addDays(t, -5), endsOn: addDays(t, -2), kind: "task", completed: false, updatedAt: upd },
    { taskId: "T-5521-2", jobId: "JOB-5521", name: "Rough electrical", startsOn: addDays(t, 1), endsOn: addDays(t, 4), kind: "task", completed: false, updatedAt: upd },
    { taskId: "T-5521-3", jobId: "JOB-5521", name: "Framing inspection", startsOn: addDays(t, 5), endsOn: addDays(t, 6), kind: "inspection", completed: false, updatedAt: upd },
    { taskId: "T-5530-1", jobId: "JOB-5530", name: "Mobilize / permit", startsOn: addDays(t, 6), endsOn: addDays(t, 9), kind: "mobilize", completed: false, updatedAt: upd },
  ];
}

export function stubSchedule(): Schedule {
  const scheduled = new Set(["active", "sold_not_started"]);
  return { jobs: stubJobs().filter((j) => scheduled.has(j.phase)), tasks: stubTasks() };
}

// GET /estimates/{id}. Totals in whole US dollars (matches CC5 deal values). An unknown id returns
// "Unknown" with no total, so a deal card still renders the link without inventing numbers.
const ESTIMATES: Record<string, { status: string; total: number }> = {
  "EST-1042": { status: "Sent", total: 184500 },
  "EST-1043": { status: "Draft", total: 52300 },
  "EST-2001": { status: "Accepted", total: 1260000 },
  "EST-2014": { status: "Sent", total: 98000 },
  "EST-3300": { status: "Draft", total: 44750 },
};

export function stubEstimate(id: string): EstimateInfo {
  const hit = ESTIMATES[id];
  return hit ? { id, status: hit.status, total: hit.total } : { id, status: "Unknown", total: null };
}

// GET /customers?has_active_job=true. Used by the Awaiting-reply 1-day rule (handoff §2).
export function stubActiveClients(): ActiveClient[] {
  return [
    { email: "dana@riverwoodbuild.com", name: "Riverwood Build" },
    { email: "mgarcia@bntconstruction.com", name: "BNT Construction" },
  ];
}

// A proposal POST. The stub accepts every actor (app, claude, josh, rule) and returns 202 with a
// reference — whether the real S156 API accepts josh and rule is tabled for Josh (EZB-ASK-1). The
// reference is derived from the request so it is stable without a clock or random source.
export function stubProposal(req: ProposalRequest): ProposalReceipt {
  const key = `${req.jobId}:${req.taskId ?? "job"}:${req.toStart}:${req.actor}`;
  return { accepted: true, ref: `prop_${Buffer.from(key).toString("hex").slice(0, 12)}`, status: 202 };
}

// GET /changes. The stub reports no new changes (the webhook path carries changes in tests); the
// live path returns real entries. Returning an empty set keeps the 90-minute sync a safe no-op in
// CI while still exercising the cursor plumbing.
export function stubChanges(cursor: string | null): Changes {
  return { entries: [], cursor: cursor ?? "stub-0" };
}
