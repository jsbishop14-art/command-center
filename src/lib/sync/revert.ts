import { nowEastern } from "@/lib/kanban/time";
import { revertChange } from "@/lib/kanban/actions-layer";
import { restoreNoteSuggestion } from "@/lib/kanban/pending";
import { withdrawProposal } from "@/lib/ezbinder/proposals";
import { getChange, getRun, markReverted, type SyncChangeRow } from "./store";
import type { Actor, Board } from "@/lib/kanban/types";

// Revert a Sync change (handoff §5.4). Each change in a run's results list carries the id its revert
// path needs. A single Revert follows §5.4 — it asks when the card changed again after the Sync —
// unless force is set; Revert all forces, undoing the whole run in reverse order (spec check 1).
// Every revert is logged by the actor who pressed it.

export type RevertOutcome =
  | { status: "reverted"; seq: number }
  | { status: "already" }
  | { status: "missing" }
  | { status: "changed_again"; before: Record<string, unknown>; after: Record<string, unknown>; current: Record<string, unknown> };

type InboxPayload = {
  project: string | null;
  boards: Board[];
  suggested_at: string | null;
  suggested_by: Actor | null;
};

function revertOne(actor: Actor, change: SyncChangeRow, opts: { force?: boolean; at: string }): RevertOutcome {
  switch (change.kind) {
    case "inbox": {
      const p = (change.payload ?? {}) as InboxPayload;
      try {
        restoreNoteSuggestion(
          change.target,
          { project: p.project ?? null, boards: p.boards ?? (["josh"] as Board[]), suggested_at: p.suggested_at ?? null, suggested_by: p.suggested_by ?? null },
          actor,
          opts.at,
        );
      } catch {
        return { status: "missing" }; // the note was confirmed or dismissed since
      }
      return { status: "reverted", seq: change.seq };
    }
    case "kanban": {
      if (!change.target) return { status: "missing" };
      const r = revertChange(actor, change.target, { force: opts.force, at: opts.at });
      if (r.status === "changed_again") {
        return { status: "changed_again", before: r.before, after: r.after, current: r.current };
      }
      return { status: "reverted", seq: change.seq };
    }
    case "schedule": {
      // Withdraw is async; handled by the async caller. Should not reach here.
      return { status: "missing" };
    }
  }
}

export async function revertSyncChange(
  actor: Actor,
  runId: string,
  seq: number,
  opts?: { force?: boolean; at?: string },
): Promise<RevertOutcome> {
  const at = opts?.at ?? nowEastern();
  const change = getChange(runId, seq);
  if (!change) return { status: "missing" };
  if (change.revertedAt) return { status: "already" };

  if (change.kind === "schedule") {
    await withdrawProposal(Number(change.target), { at });
    markReverted(runId, seq, at);
    return { status: "reverted", seq };
  }

  const out = revertOne(actor, change, { force: opts?.force, at });
  if (out.status === "reverted") markReverted(runId, seq, at);
  return out;
}

export type RevertAllResult = { reverted: number; skipped: number };

// Revert all from one run (handoff §5.1, §5.4; spec check 1). Forces each revert and undoes in
// reverse order so a later change is undone before an earlier one it may depend on.
export async function revertAllFromRun(actor: Actor, runId: string, opts?: { at?: string }): Promise<RevertAllResult> {
  const at = opts?.at ?? nowEastern();
  const run = getRun(runId);
  if (!run) return { reverted: 0, skipped: 0 };
  let reverted = 0;
  let skipped = 0;
  for (const change of [...run.changes].sort((a, b) => b.seq - a.seq)) {
    if (change.revertedAt) {
      skipped++;
      continue;
    }
    const out = await revertSyncChange(actor, runId, change.seq, { force: true, at });
    if (out.status === "reverted") reverted++;
    else skipped++;
  }
  return { reverted, skipped };
}
