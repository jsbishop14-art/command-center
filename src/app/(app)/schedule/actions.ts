"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { createProposal, resolveProposal } from "@/lib/ezbinder/proposals";
import { ezbSync } from "@/lib/ezbinder/sync";

// Server actions for the GC schedule (handoff §2.2). Josh drags a job's or task's dates; the move
// goes to EZ Binder as a proposal and shows on the grid until he confirms it in EZ Binder. He can
// also reject a proposal (his own, the slip rule's or Claude's) to clear it. Christine sees
// everything and uses the app (handoff §1.1), so both logins may propose; the proposal is sent
// under X-EZB-Actor josh for a hand move (handoff §7.2). No AI here.

function requireUser() {
  const user = currentUser();
  if (!user) redirect("/signin");
  return user;
}

// Josh drags a task bar to new dates. The move is sent to EZ Binder as a proposal (202) and stored;
// EZ Binder changes nothing until Josh confirms the move there (spec §3).
export async function proposeMoveAction(formData: FormData): Promise<void> {
  requireUser();
  const jobId = String(formData.get("jobId") || "").trim();
  const taskId = String(formData.get("taskId") || "").trim() || null;
  const fromStart = String(formData.get("fromStart") || "").trim() || null;
  const fromEnd = String(formData.get("fromEnd") || "").trim() || null;
  const toStart = String(formData.get("toStart") || "").trim();
  const toEnd = String(formData.get("toEnd") || "").trim();
  if (!jobId || !toStart || !toEnd) return;
  try {
    await createProposal({
      jobId,
      taskId,
      source: "josh",
      fromStart,
      fromEnd,
      toStart,
      toEnd,
      note: taskId ? `Josh moved a task on the schedule.` : `Josh moved a job on the schedule.`,
    });
  } catch {
    // A failed proposal is surfaced on reload; nothing changes in EZ Binder.
  }
  revalidatePath("/schedule");
  revalidatePath("/home");
}

export async function rejectProposalAction(formData: FormData): Promise<void> {
  requireUser();
  const id = Number(formData.get("id"));
  if (id) resolveProposal(id, "rejected");
  revalidatePath("/schedule");
  revalidatePath("/home");
}

// Pull the latest from EZ Binder on demand (the 90-minute safety net, run by hand here). No AI.
export async function syncScheduleAction(): Promise<void> {
  requireUser();
  await ezbSync();
  revalidatePath("/schedule");
  revalidatePath("/home");
}
