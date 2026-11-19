"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { startReconciler } from "@/lib/kanban/reconciler";
import {
  addCard,
  updateCard,
  moveCard,
  appendNote,
  revertChange,
  ActionError,
} from "@/lib/kanban/actions-layer";
import { getBoard } from "@/lib/prefs";
import { BOARDS, type Board } from "@/lib/kanban/types";

// Server actions for the kanban UI. Josh and Christine edit through the app (the app is the writer
// that touches the files — handoff §4; Christine cannot edit the files directly but uses the app).
// Every action runs as the signed-in user's role, so the activity log attributes it correctly.

function actor(): "josh" | "christine" {
  const user = currentUser();
  if (!user) redirect("/signin");
  startReconciler();
  return user.role;
}

export type ActionResult = { ok: boolean; error?: string; id?: string };

export async function quickAddAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const who = actor();
  const user = currentUser()!;
  const title = String(formData.get("title") || "").trim();
  const area = String(formData.get("area") || "business");
  if (!title) return { ok: false, error: "Enter a title." };
  const board = getBoard(user.id, user.role) as Board;
  try {
    const card = addCard(who, { title, area, boards: [board], stage: "inbox", source: "manual" });
    revalidatePath("/kanban");
    return { ok: true, id: card.id };
  } catch (e) {
    return { ok: false, error: e instanceof ActionError ? e.message : "Could not add the card." };
  }
}

export async function saveFieldsAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  const area = formData.get("area");
  const project = formData.get("project");
  const due = formData.get("due");
  try {
    updateCard(who, id, {
      area: area != null ? String(area) : undefined,
      project: project != null ? (String(project) || null) : undefined,
      due: due != null ? (String(due) || null) : undefined,
    });
  } catch {
    // surfaced on reload; invalid values are rejected
  }
  revalidatePath("/kanban");
}

export async function toggleBoardAction(id: string, board: string, on: boolean): Promise<void> {
  const who = actor();
  if (!(BOARDS as readonly string[]).includes(board)) return;
  const { readCard } = await import("@/lib/kanban/actions-layer");
  try {
    const card = readCard(id);
    const set = new Set(card.boards);
    if (on) set.add(board as Board);
    else set.delete(board as Board);
    const boards = [...set];
    if (boards.length === 0) return; // a card must stay on at least one board
    updateCard(who, id, { boards });
  } catch {
    // ignore
  }
  revalidatePath("/kanban");
}

export async function saveNotesAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  const notes = String(formData.get("notes") || "");
  try {
    updateCard(who, id, { notes });
  } catch {
    // ignore
  }
  revalidatePath("/kanban");
}

export async function appendNoteAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  const text = String(formData.get("text") || "").trim();
  if (text) {
    try {
      appendNote(who, id, text);
    } catch {
      // ignore
    }
  }
  revalidatePath("/kanban");
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  const stage = String(formData.get("stage") || "");
  try {
    moveCard(who, id, stage);
  } catch {
    // ignore
  }
  revalidatePath("/kanban");
}

export async function discardAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  try {
    moveCard(who, id, "discarded");
  } catch {
    // ignore
  }
  revalidatePath("/kanban");
  redirect("/kanban");
}

export async function restoreAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = String(formData.get("id") || "");
  const { restoreCard } = await import("@/lib/kanban/reconciler");
  const { nowEastern } = await import("@/lib/kanban/time");
  try {
    restoreCard(id, nowEastern(), who);
  } catch {
    // ignore
  }
  revalidatePath("/kanban");
  redirect(`/kanban?card=${encodeURIComponent(id)}`);
}

export type RevertState = { ok?: boolean; status?: string; error?: string; versions?: unknown };

export async function revertAction(_prev: RevertState, formData: FormData): Promise<RevertState> {
  const who = actor();
  const logId = String(formData.get("logId") || "");
  const force = String(formData.get("force") || "") === "1";
  try {
    const result = revertChange(who, logId, { force });
    revalidatePath("/kanban");
    if (result.status === "changed_again") {
      return {
        ok: false,
        status: "changed_again",
        versions: { before: result.before, after: result.after, current: result.current },
      };
    }
    return { ok: true, status: "reverted" };
  } catch (e) {
    return { ok: false, error: e instanceof ActionError ? e.message : "Could not revert." };
  }
}
