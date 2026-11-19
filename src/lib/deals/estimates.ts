import { liveFeeds } from "@/lib/feeds/mode";

// EZ Binder estimate lookup for deal cards (handoff §3.3: "Deal cards show each linked estimate's
// status and total from EZ Binder GET /estimates/{id}"). The real call arrives in CC6; until then
// this stub stands in for CI, build sessions and local dev (spec §2). Ordinary code, NO AI, and no
// real outside call: the live path returns "unknown" until CC6 wires EZ Binder (handoff §7.5).

export type EstimateInfo = { id: string; status: string; total: number | null };

const STUB: Record<string, { status: string; total: number }> = {
  "EST-1042": { status: "Sent", total: 184500 },
  "EST-1043": { status: "Draft", total: 52300 },
  "EST-2001": { status: "Accepted", total: 1260000 },
  "EST-2014": { status: "Sent", total: 98000 },
  "EST-3300": { status: "Draft", total: 44750 },
};

// Look up one estimate. An id not in the stub (or any id on the live path before CC6) returns
// status "Unknown" with no total, so a deal card still renders the link without inventing numbers.
export function estimateInfo(id: string): EstimateInfo {
  if (liveFeeds()) return { id, status: "Unknown", total: null };
  const hit = STUB[id];
  return hit ? { id, status: hit.status, total: hit.total } : { id, status: "Unknown", total: null };
}

export function estimateInfos(ids: string[]): EstimateInfo[] {
  return ids.map(estimateInfo);
}
