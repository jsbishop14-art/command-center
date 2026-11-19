import { liveFeeds } from "@/lib/feeds/mode";
import type { Board } from "@/lib/kanban/types";

// GC jobs for the Projects grid (handoff §2: "GC jobs: from EZ Binder, grouped by computed phase").
// The real source is EZ Binder, wired in CC6; CC5 uses this stub for the grid (spec §2). Ordinary
// code, NO AI, no real outside call: the live path returns nothing until CC6 (handoff §7.5), so the
// grid simply shows no GC jobs on a real Mac mini until EZ Binder is connected.

export type GcPhase = "sold_not_started" | "active" | "punch";

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

const STUB: GcJob[] = [
  {
    id: "JOB-5521",
    name: "Riverwood pool house",
    phase: "active",
    nowTask: "Framing inspection",
    nextTask: "Rough electrical",
    due: "2026-12-04",
    money: "$184,500 billed / $120,000 paid",
    boards: ["josh"],
  },
  {
    id: "JOB-5530",
    name: "Garcia pool deck",
    phase: "sold_not_started",
    nowTask: "Awaiting permit",
    nextTask: "Demo",
    due: "2026-12-18",
    money: "$52,300 billed / $0 paid",
    boards: ["josh"],
  },
  {
    id: "JOB-5490",
    name: "Maple St kitchen",
    phase: "punch",
    nowTask: "Punch list",
    nextTask: "Final walk-through",
    due: "2026-11-26",
    money: "$96,000 billed / $90,000 paid",
    boards: ["josh"],
  },
];

export function gcJobs(): GcJob[] {
  if (liveFeeds()) return []; // EZ Binder is wired in CC6; no real customer call here.
  return STUB;
}
