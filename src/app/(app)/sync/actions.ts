"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { runSync, previewCounts, ALL_ITEMS, type SyncPreview } from "@/lib/sync/engine";
import { revertSyncChange, revertAllFromRun, type RevertOutcome } from "@/lib/sync/revert";
import { usageSummary, usage30Days, type UsageSummary } from "@/lib/sync/usage";
import { lastRun, type SyncRun, type SyncItemKey } from "@/lib/sync/store";
import type { DailyUsage } from "@/lib/sync/store";
import type { Actor } from "@/lib/kanban/types";

// Server actions behind the Sync-with-Claude button (handoff §5.1). Claude runs only when Josh (or
// Christine) presses Run sync here — there is no timer (handoff §8). The changes are attributed to
// actor claude; `by` records the login who pressed it. Signed-out callers are refused.

function actorOrNull(): Actor | null {
  const u = currentUser();
  if (!u) return null;
  return u.role as Actor;
}

export type SyncInfo = {
  preview: SyncPreview;
  usage: UsageSummary;
  usage30: DailyUsage[];
  lastRunAt: string | null;
};

// What the dialog shows before a run: per-item "new" counts and the usage tiles + 30-day chart.
export async function syncInfoAction(): Promise<SyncInfo | { error: string }> {
  if (!actorOrNull()) return { error: "Sign in first." };
  const prev = lastRun();
  return {
    preview: previewCounts(),
    usage: usageSummary(),
    usage30: usage30Days(),
    lastRunAt: prev?.finishedAt ?? null,
  };
}

export async function runSyncAction(items: SyncItemKey[]): Promise<{ run: SyncRun } | { error: string }> {
  const by = actorOrNull();
  if (!by) return { error: "Sign in first." };
  const requested = (items ?? ALL_ITEMS).filter((i): i is SyncItemKey => ALL_ITEMS.includes(i));
  if (requested.length === 0) return { error: "Pick at least one item to run." };
  const run = await runSync({ items: requested, by });
  // The Inbox count and card lists may have changed.
  revalidatePath("/", "layout");
  return { run };
}

export async function revertSyncAction(
  runId: string,
  seq: number,
  force: boolean,
): Promise<{ outcome: RevertOutcome; run: SyncRun | null } | { error: string }> {
  const by = actorOrNull();
  if (!by) return { error: "Sign in first." };
  const outcome = await revertSyncChange(by, runId, seq, { force });
  revalidatePath("/", "layout");
  const { getRun } = await import("@/lib/sync/store");
  return { outcome, run: getRun(runId) };
}

export async function revertAllSyncAction(
  runId: string,
): Promise<{ reverted: number; skipped: number; run: SyncRun | null } | { error: string }> {
  const by = actorOrNull();
  if (!by) return { error: "Sign in first." };
  const result = await revertAllFromRun(by, runId);
  revalidatePath("/", "layout");
  const { getRun } = await import("@/lib/sync/store");
  return { ...result, run: getRun(runId) };
}
