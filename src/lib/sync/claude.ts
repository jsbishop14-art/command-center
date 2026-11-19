import { execFileSync } from "node:child_process";
import { liveAI } from "./mode";
import type { Board } from "@/lib/kanban/types";

// The Claude client: the single place in the app that "runs Claude" (handoff §5, §8: nothing calls
// Claude except the Sync button). Each item's decision is made here. The default everywhere is the
// stub, which stands in for Claude with deterministic output and a reported token count, so CI and
// build sessions make no Claude call (spec §6; CLAUDE §3). The live path runs only on the Mac mini
// (liveAI) through the Claude Code command line; it is never exercised by tests.
//
// The engine gathers the inputs and decides whether there is anything new BEFORE calling here, so an
// item with nothing new is skipped without a Claude call (handoff §5.1). This module makes no
// database or file changes; the engine applies the decisions through the action layer.

export type SyncModel = "claude-haiku-4-5" | "claude-sonnet-5";

export type Usage = { tokens: number; model: SyncModel };

// Model per item — the smallest that does the job well (handoff §5.6).
export const ITEM_MODEL: Record<"inbox" | "kanban" | "schedule", SyncModel> = {
  inbox: "claude-haiku-4-5",
  kanban: "claude-sonnet-5",
  schedule: "claude-haiku-4-5",
};

// ---- Sort Inbox notes (handoff §5.1 item 1) ----------------------------------------------------
// Suggest a project and boards for each pending note that has no suggestion, from board.yaml, deals,
// the Contacts list and EZ Binder customers. Nothing files; the suggestion waits in the Inbox.

export type InboxNote = { id: string; text: string };
export type InboxContext = { projects: string[]; christineHints: string[] };
export type InboxDecision = { noteId: string; project: string | null; boards: Board[] };

export async function sortInbox(
  notes: InboxNote[],
  ctx: InboxContext,
): Promise<{ decisions: InboxDecision[]; usage: Usage }> {
  const model = ITEM_MODEL.inbox;
  if (liveAI()) {
    const out = runClaude<InboxDecision[]>(model, "sort-inbox", { notes, ctx });
    return { decisions: out, usage: { tokens: 0, model } };
  }
  const decisions = notes.map((n) => stubInboxDecision(n, ctx));
  return { decisions, usage: { tokens: 1200 + 350 * notes.length, model } };
}

function stubInboxDecision(note: InboxNote, ctx: InboxContext): InboxDecision {
  const text = note.text.toLowerCase();
  // Project: the first candidate whose first word appears in the note text.
  let project: string | null = null;
  for (const p of ctx.projects) {
    const word = p.toLowerCase().split(/\s+/)[0];
    if (word && word.length >= 3 && text.includes(word)) {
      project = p;
      break;
    }
  }
  // Boards: add Christine (and the shared Bishops board) when the note reads personal/household.
  const personal =
    /\b(bishop|christine|home|house|personal|family|kid|school|vacation)\b/.test(text) ||
    ctx.christineHints.some((h) => h && text.includes(h.toLowerCase()));
  const boards = (personal ? ["josh", "christine"] : ["josh"]) as Board[];
  return { noteId: note.id, project, boards };
}

// ---- Kanban updates (handoff §5.1 item 2) ------------------------------------------------------
// Add or move cards from new notes, emails and EZ Binder changes since the last Sync. Applied
// directly, within the Claude limits (handoff §4.7 rule 8): never into done/discarded, never a
// board change, bodies append-only. The stub adds a card for each new EZ Binder job.

export type KanbanCandidate = {
  source: "ezbinder";
  sourceRef: string;
  title: string;
  boards: Board[];
  project: string;
  detail: string;
};
export type KanbanDecision = {
  op: "add";
  title: string;
  stage: string;
  boards: Board[];
  project: string;
  source: string;
  sourceRef: string;
  notes: string;
};

export async function kanbanUpdates(
  candidates: KanbanCandidate[],
): Promise<{ decisions: KanbanDecision[]; usage: Usage }> {
  const model = ITEM_MODEL.kanban;
  if (liveAI()) {
    const out = runClaude<KanbanDecision[]>(model, "kanban-updates", { candidates });
    return { decisions: out, usage: { tokens: 0, model } };
  }
  const decisions: KanbanDecision[] = candidates.map((c) => ({
    op: "add",
    title: c.title,
    stage: "next", // not done/discarded — within §4.7 rule 8
    boards: c.boards,
    project: c.project,
    source: c.source,
    sourceRef: c.sourceRef,
    notes: c.detail,
  }));
  return { decisions, usage: { tokens: 2000 + 600 * candidates.length, model } };
}

// ---- Schedule proposals (handoff §5.1 item 3, §2.2) --------------------------------------------
// Propose schedule moves from EZ Binder data. Each is sent as a proposal under X-EZB-Actor claude
// and changes nothing in EZ Binder until Josh confirms. The stub shifts the candidate task forward.

export type ScheduleCandidate = {
  jobId: string;
  jobName: string;
  taskId: string;
  taskName: string;
  startsOn: string;
  endsOn: string;
};
export type ScheduleDecision = {
  jobId: string;
  taskId: string;
  fromStart: string;
  fromEnd: string;
  toStart: string;
  toEnd: string;
  note: string;
};

export async function scheduleProposals(
  candidates: ScheduleCandidate[],
  shift: (date: string, days: number) => string,
): Promise<{ decisions: ScheduleDecision[]; usage: Usage }> {
  const model = ITEM_MODEL.schedule;
  if (liveAI()) {
    const out = runClaude<ScheduleDecision[]>(model, "schedule-proposals", { candidates });
    return { decisions: out, usage: { tokens: 0, model } };
  }
  const days = 2;
  const decisions: ScheduleDecision[] = candidates.map((c) => ({
    jobId: c.jobId,
    taskId: c.taskId,
    fromStart: c.startsOn,
    fromEnd: c.endsOn,
    toStart: shift(c.startsOn, days),
    toEnd: shift(c.endsOn, days),
    note: `Re-sequence "${c.taskName}" on ${c.jobName} by ${days} day(s) to open the crew's week.`,
  }));
  return { decisions, usage: { tokens: 900 + 400 * candidates.length, model } };
}

// ---- The live Claude Code call (Mac mini only; never run in tests) -----------------------------
// Runs Claude headless through the Claude Code command line, signed in to Josh's plan with no API
// key (spec §2, §5.6). The prompt asks for strict JSON of the decision shape. Usage would be parsed
// from Claude's output; because the live path is gated to the Mac mini and never exercised here, it
// is intentionally minimal. The engine always records a usage figure for the item regardless.
function runClaude<T>(model: SyncModel, task: string, input: unknown): T {
  const prompt =
    `You are the Command Center Sync task "${task}". Decide the changes from this JSON input and ` +
    `reply with ONLY a JSON array of the decision objects, no prose.\n\n${JSON.stringify(input)}`;
  const out = execFileSync("claude", ["--model", model, "--print", prompt], { encoding: "utf8" });
  return JSON.parse(out) as T;
}
