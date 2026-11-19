"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { confirmNote, dismissNote } from "@/lib/kanban/pending";
import { dismissThread } from "@/lib/feeds/awaiting";
import { nudge } from "@/lib/feeds/nudge";
import { nowEastern } from "@/lib/kanban/time";
import { BOARDS, type Board, type Actor } from "@/lib/kanban/types";

// Server actions for the Inbox and Awaiting reply (handoff §2, §4.4, spec §1). All require a signed
// -in user. Nothing becomes a card without Confirm; Nudge only ever creates a Gmail draft.

function keepBoards(values: FormDataEntryValue[]): Board[] {
  const set = new Set(values.map(String));
  const kept = (BOARDS as readonly string[]).filter((b) => set.has(b)) as Board[];
  return kept.length ? kept : (["josh"] as Board[]);
}

function revalidateInbox() {
  revalidatePath("/", "layout"); // nav Inbox count
  revalidatePath("/home");
  revalidatePath("/inbox");
}

// Confirm a pending note into a card (handoff §4.4). Change is the same action with project/boards
// chosen first, so Confirm and Change share this path; the plain Confirm sends the note's current
// suggestion. actor is the signed-in user.
export async function confirmNoteAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const noteId = String(formData.get("noteId") || "");
  if (!noteId) return;
  const projectRaw = String(formData.get("project") || "").trim();
  const input: { project?: string | null; boards?: Board[] } = {};
  if (formData.has("project")) input.project = projectRaw || null;
  if (formData.getAll("boards").length) input.boards = keepBoards(formData.getAll("boards"));
  confirmNote(noteId, input, user.role as Actor, nowEastern());
  revalidateInbox();
}

// Dismiss a pending note (handoff §4.4): removed without making a card.
export async function dismissNoteAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const noteId = String(formData.get("noteId") || "");
  if (!noteId) return;
  dismissNote(noteId, user.role as Actor, nowEastern());
  revalidateInbox();
}

// No reply needed (handoff §2): hide this one Awaiting-reply thread, not future emails in it.
export async function noReplyNeededAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const threadId = String(formData.get("threadId") || "");
  if (!threadId) return;
  dismissThread(threadId, nowEastern());
  revalidateInbox();
}

export type NudgeState = { ok?: boolean; to?: string; error?: string };

// Nudge (handoff §2, §2.1): create a Gmail draft in the thread from template B. Never sends.
export async function nudgeAction(_prev: NudgeState, formData: FormData): Promise<NudgeState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const threadId = String(formData.get("threadId") || "");
  if (!threadId) return { error: "No thread." };
  try {
    const draft = nudge(threadId, nowEastern());
    revalidateInbox();
    return { ok: true, to: draft.to };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the draft." };
  }
}
