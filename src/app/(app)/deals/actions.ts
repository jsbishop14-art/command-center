"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import {
  createDeal,
  updateDeal,
  archiveDeal,
  restoreDeal,
  linkEstimate,
  unlinkEstimate,
  revertDeal,
  readDeal,
  ActionError,
} from "@/lib/deals/actions";
import { linkContactDeal, unlinkContactDeal } from "@/lib/deals/store";
import { getBoard } from "@/lib/prefs";
import { BOARDS, type Board } from "@/lib/kanban/types";

// Server actions for the Deals UI. Josh and Christine edit through the app; every write goes through
// the deal action layer (handoff §4.8, spec §3), so Claude and Duet never differ from the UI path.
// Each action runs as the signed-in user's role so the history is attributed correctly.

function actor(): "josh" | "christine" {
  const user = currentUser();
  if (!user) redirect("/signin");
  return user.role;
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type DealFormState = { ok?: boolean; id?: number; error?: string };

export async function createDealAction(_prev: DealFormState, formData: FormData): Promise<DealFormState> {
  const who = actor();
  const user = currentUser()!;
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "sale");
  if (!name) return { ok: false, error: "Enter a deal name." };
  const board = getBoard(user.id, user.role) as Board;
  try {
    const deal = createDeal(who, { name, type, boards: [board] });
    revalidatePath("/deals");
    return { ok: true, id: deal.id };
  } catch (e) {
    return { ok: false, error: e instanceof ActionError ? e.message : "Could not create the deal." };
  }
}

export async function saveDealAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = Number(formData.get("id"));
  try {
    updateDeal(who, id, {
      type: formData.get("type") != null ? String(formData.get("type")) : undefined,
      stage: formData.get("stage") != null ? String(formData.get("stage")) : undefined,
      value: numOrNull(formData.get("value")),
      probability: numOrNull(formData.get("probability")),
      currentTask: formData.get("currentTask") != null ? String(formData.get("currentTask")) : undefined,
      nextAction: formData.get("nextAction") != null ? String(formData.get("nextAction")) : undefined,
      nextActionDate: formData.get("nextActionDate") != null ? (String(formData.get("nextActionDate")) || null) : undefined,
      notes: formData.get("notes") != null ? String(formData.get("notes")) : undefined,
      customerId: formData.get("customerId") != null ? (String(formData.get("customerId")) || null) : undefined,
      jobId: formData.get("jobId") != null ? (String(formData.get("jobId")) || null) : undefined,
    });
  } catch {
    // Invalid values are rejected; surfaced on reload.
  }
  revalidatePath("/deals");
}

export async function toggleDealBoardAction(id: number, board: string, on: boolean): Promise<void> {
  const who = actor();
  if (!(BOARDS as readonly string[]).includes(board)) return;
  try {
    const deal = readDeal(id);
    const set = new Set(deal.boards);
    if (on) set.add(board as Board);
    else set.delete(board as Board);
    const boards = [...set];
    if (boards.length === 0) return; // a deal must stay on at least one board
    updateDeal(who, id, { boards });
  } catch {
    // ignore
  }
  revalidatePath("/deals");
}

export async function archiveDealAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = Number(formData.get("id"));
  try {
    archiveDeal(who, id);
  } catch {
    // ignore
  }
  revalidatePath("/deals");
  redirect("/deals");
}

export async function restoreDealAction(formData: FormData): Promise<void> {
  const who = actor();
  const id = Number(formData.get("id"));
  try {
    restoreDeal(who, id);
  } catch {
    // ignore
  }
  revalidatePath("/deals");
  redirect(`/deals?deal=${id}`);
}

export async function linkEstimateAction(formData: FormData): Promise<void> {
  actor();
  const id = Number(formData.get("id"));
  const estimateId = String(formData.get("estimateId") || "").trim();
  if (estimateId) {
    try {
      linkEstimate(id, estimateId);
    } catch {
      // ignore
    }
  }
  revalidatePath("/deals");
}

export async function unlinkEstimateAction(formData: FormData): Promise<void> {
  actor();
  const id = Number(formData.get("id"));
  const estimateId = String(formData.get("estimateId") || "");
  try {
    unlinkEstimate(id, estimateId);
  } catch {
    // ignore
  }
  revalidatePath("/deals");
}

export async function linkDealContactAction(formData: FormData): Promise<void> {
  actor();
  const id = Number(formData.get("id"));
  const contactId = Number(formData.get("contactId"));
  if (id && contactId) linkContactDeal(contactId, id);
  revalidatePath("/deals");
}

export async function unlinkDealContactAction(formData: FormData): Promise<void> {
  actor();
  const id = Number(formData.get("id"));
  const contactId = Number(formData.get("contactId"));
  if (id && contactId) unlinkContactDeal(contactId, id);
  revalidatePath("/deals");
}

export type DealRevertState = { ok?: boolean; status?: string; error?: string; versions?: unknown };

export async function revertDealAction(_prev: DealRevertState, formData: FormData): Promise<DealRevertState> {
  const who = actor();
  const changeId = Number(formData.get("changeId"));
  const force = String(formData.get("force") || "") === "1";
  try {
    const result = revertDeal(who, changeId, { force });
    revalidatePath("/deals");
    if (result.status === "changed_again") {
      return { ok: false, status: "changed_again", versions: { before: result.before, after: result.after, current: result.current } };
    }
    return { ok: true, status: "reverted" };
  } catch (e) {
    return { ok: false, error: e instanceof ActionError ? e.message : "Could not revert." };
  }
}
