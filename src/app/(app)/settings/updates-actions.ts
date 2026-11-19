"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { runCheckNow } from "@/lib/builds/updates";

// Settings → Updates: "Check for updates now" (CC12 spec §1, check 2). Runs one updater pass and
// returns its result. Available to both logins (Josh and Christine both use the app). No AI.

export type UpdatesCheckState = { ok?: boolean; error?: string; at?: string; detail?: string };

export async function checkForUpdatesAction(
  _prev: UpdatesCheckState,
  _formData: FormData,
): Promise<UpdatesCheckState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const status = runCheckNow();
  revalidatePath("/settings");
  return { ok: true, at: status.lastCheck?.at, detail: status.lastCheck?.detail };
}
