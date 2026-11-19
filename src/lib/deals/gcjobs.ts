import type { Board } from "@/lib/kanban/types";
import { listJobs } from "@/lib/ezbinder/store";
import { jobMoney } from "@/lib/ezbinder/view";
import type { GcPhase } from "@/lib/ezbinder/types";

// GC jobs for the Projects grid (handoff §2: "GC jobs: from EZ Binder, grouped by computed phase").
// Since CC6 the source is the EZ Binder cache (ezb_jobs), filled by the sync and webhooks from EZ
// Binder (a stub until S156 is live). Before the first sync the cache is empty, so the grid simply
// shows no GC jobs. Ordinary code, NO AI.

export type { GcPhase };

export type GcJob = {
  id: string;
  name: string;
  phase: GcPhase;
  nowTask: string;
  nextTask: string;
  due: string | null;
  money: string;
  boards: Board[];
};

export const GC_PHASE_LABEL: Record<GcPhase, string> = {
  sold_not_started: "Sold, not started",
  active: "Active",
  punch: "Punch",
};

export function gcJobs(): GcJob[] {
  return listJobs().map((j) => ({
    id: j.jobId,
    name: j.name,
    phase: j.phase,
    nowTask: j.nowTask,
    nextTask: j.nextTask,
    due: j.due,
    money: jobMoney(j),
    boards: j.boards as Board[],
  }));
}
