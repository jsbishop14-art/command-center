"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setTouchIdleMinutes, MIN_IDLE_MINUTES, MAX_IDLE_MINUTES } from "@/lib/touch/settings";

// Settings → Touch screen (handoff §6: the idle return time is editable). Writes only the local
// app_settings value; no outside call, no AI.

export type TouchIdleState = { ok?: boolean; error?: string; saved?: number };

export async function saveTouchIdleAction(
  _prev: TouchIdleState,
  formData: FormData,
): Promise<TouchIdleState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const raw = String(formData.get("minutes") || "").trim();
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return { error: "Enter a number of minutes." };
  if (n < MIN_IDLE_MINUTES || n > MAX_IDLE_MINUTES) {
    return { error: `Use ${MIN_IDLE_MINUTES} to ${MAX_IDLE_MINUTES} minutes.` };
  }
  const saved = setTouchIdleMinutes(n);
  revalidatePath("/settings");
  revalidatePath("/touch");
  return { ok: true, saved };
}
