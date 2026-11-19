import { nowEastern, todayEastern } from "@/lib/kanban/time";
import { addCard } from "@/lib/kanban/actions-layer";
import { listPending, suggestNote } from "@/lib/kanban/pending";
import { readEntries } from "@/lib/kanban/activity";
import { sourceRefExists } from "@/lib/kanban/reconciler";
import { commitKanban, isKanbanRepo } from "@/lib/kanban/git";
import { listJobs, listTasks } from "@/lib/ezbinder/store";
import { listProposals, createProposal } from "@/lib/ezbinder/proposals";
import { addDays } from "@/lib/ezbinder/dates";
import { listDeals } from "@/lib/deals/actions";
import { listContacts } from "@/lib/deals/store";
import {
  sortInbox,
  kanbanUpdates,
  scheduleProposals,
  ITEM_MODEL,
  type InboxNote,
  type InboxContext,
  type KanbanCandidate,
  type ScheduleCandidate,
} from "./claude";
import { createRun, addRunItem, addChange, finishRun, getRun, type SyncItemKey, type SyncRun } from "./store";
import type { Actor, Board } from "@/lib/kanban/types";

// The Sync engine (handoff §5.1). Runs only when Josh presses Run sync (handoff §8: no timer). For
// each requested item it works out whether there is anything new in ordinary code; an item with
// nothing new is skipped WITHOUT calling Claude (handoff §5.1). Otherwise it asks the Claude client
// (the stub in CI/build/dev, spec §6) for the decisions, applies them through the action layer, and
// records the changes and per-item usage. Changes are attributed to actor claude with the run id so
// each is revertable (handoff §5.4). After the run the kanban folder is committed to git (§4.10).

export const ALL_ITEMS: SyncItemKey[] = ["inbox", "kanban", "schedule"];

// A stable run id from the start instant (sync-YYYYMMDD-HHMMSS, handoff mockup SyncResults).
export function runIdFor(at: string): string {
  return "sync-" + at.replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

// ---- "anything new" previews (ordinary code, no Claude) ----------------------------------------

function inboxNotes(): InboxNote[] {
  // Pending notes with no suggestion yet (handoff §5.1 item 1).
  return listPending()
    .filter((n) => !n.suggested_at)
    .map((n) => ({ id: n.id, text: n.text }));
}

function inboxContext(): InboxContext {
  const projects = [
    ...listDeals().map((d) => d.name),
    ...listJobs().map((j) => j.name),
  ].filter((s): s is string => !!s);
  const christineHints = listContacts()
    .filter((c) => /christine|bishop/i.test(c.name))
    .map((c) => c.name);
  return { projects, christineHints };
}

function kanbanCandidates(): KanbanCandidate[] {
  // New EZ Binder jobs with no card yet (deduped by source_ref, handoff §4.7 rule 7).
  return listJobs()
    .filter((j) => !sourceRefExists(j.jobId))
    .map((j) => ({
      source: "ezbinder" as const,
      sourceRef: j.jobId,
      title: j.name,
      boards: j.boards as Board[],
      project: j.name,
      detail: `From EZ Binder job ${j.jobId} (${j.phase}). Now: ${j.nowTask || "—"}; next: ${j.nextTask || "—"}.`,
    }));
}

function scheduleCandidates(): ScheduleCandidate[] {
  // One candidate per active job that has no open Claude proposal: its next upcoming incomplete
  // task. Separate from the slip rule (ordinary code), so the two sources do not collide.
  const today = todayEastern();
  const openClaudeJobs = new Set(
    listProposals({ status: "proposed" }).filter((p) => p.source === "claude").map((p) => p.jobId),
  );
  const out: ScheduleCandidate[] = [];
  for (const job of listJobs()) {
    if (job.phase === "punch") continue; // not on the schedule grid
    if (openClaudeJobs.has(job.jobId)) continue;
    const next = listTasks()
      .filter((t) => t.jobId === job.jobId && !t.completed && t.startsOn >= today)
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
    if (!next) continue;
    out.push({
      jobId: job.jobId,
      jobName: job.name,
      taskId: next.taskId,
      taskName: next.name,
      startsOn: next.startsOn,
      endsOn: next.endsOn,
    });
  }
  return out;
}

// How many items each requested Sync item would act on right now (for the dialog's "n new" counts
// and to show which items would be skipped). Ordinary code, no Claude (handoff §5.1).
export type SyncPreview = { inbox: number; kanban: number; schedule: number };

export function previewCounts(): SyncPreview {
  return {
    inbox: inboxNotes().length,
    kanban: kanbanCandidates().length,
    schedule: scheduleCandidates().length,
  };
}

// ---- the run -----------------------------------------------------------------------------------

export type RunSyncOptions = { items?: SyncItemKey[]; by: Actor; at?: string };

export async function runSync(opts: RunSyncOptions): Promise<SyncRun> {
  const at = opts.at ?? nowEastern();
  const requested = (opts.items ?? ALL_ITEMS).filter((i) => ALL_ITEMS.includes(i));
  const runId = runIdFor(at);

  // Decide, in ordinary code, which requested items have anything new.
  const notes = requested.includes("inbox") ? inboxNotes() : [];
  const kCands = requested.includes("kanban") ? kanbanCandidates() : [];
  const sCands = requested.includes("schedule") ? scheduleCandidates() : [];

  const ran: SyncItemKey[] = [];
  const skipped: SyncItemKey[] = [];
  for (const item of requested) {
    const hasNew =
      (item === "inbox" && notes.length > 0) ||
      (item === "kanban" && kCands.length > 0) ||
      (item === "schedule" && sCands.length > 0);
    (hasNew ? ran : skipped).push(item);
  }

  createRun({ id: runId, by: opts.by, items: ran, skipped, startedAt: at });

  let seq = 0;
  let totalTokens = 0;

  // 1. Sort Inbox notes — suggestions only; nothing files (handoff §5.1 item 1).
  if (ran.includes("inbox")) {
    const { decisions, usage } = await sortInbox(notes, inboxContext());
    let count = 0;
    for (const d of decisions) {
      const before = listPending().find((n) => n.id === d.noteId);
      suggestNote(d.noteId, { project: d.project, boards: d.boards }, "claude", at, runId);
      addChange({
        runId,
        seq: seq++,
        kind: "inbox",
        target: d.noteId,
        label: `Suggested ${d.project ?? "no project"} · ${boardNames(d.boards)} for ${d.noteId}`,
        sub: "Waits in Inbox for your Confirm",
        action: "Revert",
        payload: {
          project: before?.suggested_project ?? null,
          boards: before?.boards ?? ["josh"],
          suggested_at: before?.suggested_at ?? null,
          suggested_by: before?.suggested_by ?? null,
        },
      });
      count++;
    }
    addRunItem(runId, "inbox", usage.model, usage.tokens, count, at);
    totalTokens += usage.tokens;
  }

  // 2. Kanban updates — apply directly within §4.7 rule 8 (handoff §5.1 item 2).
  if (ran.includes("kanban")) {
    const { decisions, usage } = await kanbanUpdates(kCands);
    let count = 0;
    for (const d of decisions) {
      const card = addCard(
        "claude",
        {
          title: d.title,
          stage: d.stage,
          boards: d.boards,
          project: d.project,
          source: d.source,
          source_ref: d.sourceRef,
          notes: d.notes,
        },
        { at, run: runId },
      );
      addChange({
        runId,
        seq: seq++,
        kind: "kanban",
        target: card.id,
        label: `Added "${card.title}" to ${stageName(card.stage)}`,
        sub: `${card.id} · source ${d.source}`,
        action: "Revert",
        // op "add": reverting a creation discards the card (soft delete, §4.7 rule 3), since a
        // create has no "before" values to restore. logId is kept for the audit trail.
        payload: { op: "add", logId: logIdForCard(card.id, runId) },
      });
      count++;
    }
    addRunItem(runId, "kanban", usage.model, usage.tokens, count, at);
    totalTokens += usage.tokens;
  }

  // 3. Schedule proposals — each a proposal, nothing changes in EZ Binder until Josh confirms
  // (handoff §2.2, §5.1 item 3).
  if (ran.includes("schedule")) {
    const { decisions, usage } = await scheduleProposals(sCands, addDays);
    let count = 0;
    for (const d of decisions) {
      const prop = await createProposal(
        {
          jobId: d.jobId,
          taskId: d.taskId,
          source: "claude",
          fromStart: d.fromStart,
          fromEnd: d.fromEnd,
          toStart: d.toStart,
          toEnd: d.toEnd,
          note: d.note,
        },
        { at },
      );
      const cand = sCands.find((c) => c.taskId === d.taskId);
      addChange({
        runId,
        seq: seq++,
        kind: "schedule",
        target: String(prop.id),
        label: `Proposed ${cand?.taskName ?? d.taskId} +2 days`,
        sub: "Pending in EZ Binder until you confirm there",
        action: "Withdraw",
      });
      count++;
    }
    addRunItem(runId, "schedule", usage.model, usage.tokens, count, at);
    totalTokens += usage.tokens;
  }

  finishRun(runId, totalTokens, nowEastern());

  // Git backup of the kanban folder after every Sync (handoff §4.10, spec §3). A no-op where the
  // folder is not a git repo (CI, build sessions never touch the real folder, handoff §7.5).
  if (isKanbanRepo()) commitKanban(`Sync ${runId}`);

  return getRun(runId)!;
}

// The log id the engine's add_card just wrote for this card in this run. A created card writes one
// `create` line; we look it up so Revert can undo it (handoff §5.4).
function logIdForCard(cardId: string, runId: string): string {
  const entry = readEntries(cardId)
    .filter((e) => e.run === runId)
    .slice(-1)[0];
  return entry ? entry.id : "";
}

function boardNames(boards: Board[]): string {
  const map: Record<string, string> = { josh: "Josh", christine: "Christine", bishops: "Bishops" };
  return boards.map((b) => map[b] ?? b).join(", ");
}

function stageName(stage: string): string {
  const map: Record<string, string> = {
    inbox: "Inbox",
    next: "Next",
    in_progress: "In progress",
    waiting_on: "Waiting on",
    done: "Done",
    discarded: "Discarded",
  };
  return map[stage] ?? stage;
}
