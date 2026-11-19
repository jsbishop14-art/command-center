"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setZip } from "@/lib/feeds/store";
import { resolveTarget, disconnect } from "@/lib/feeds/connections";

// Settings actions for the Home feeds and Google connections (spec §1; handoff §7.3). Connecting a
// Google target is started by a plain link to GET /api/auth/google/start (built with
// googleConnectHref from @/lib/feeds/connect-url), which opens Google's own sign-in (the stub
// consent screen in CI / build sessions); the OAuth callback stores the token. Disconnecting is
// this server action. No real Google call is made from here or in a build session.

export async function disconnectGoogleAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) redirect("/signin");
  const t = resolveTarget(String(formData.get("target") || ""));
  if (!t) return;
  disconnect(t);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export type ZipSaveState = { ok?: boolean; error?: string };

export async function saveZipAction(_prev: ZipSaveState, formData: FormData): Promise<ZipSaveState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const zip = String(formData.get("zip") || "").trim();
  // A US zip: 5 digits. Keep it simple; the weather source expects a zip.
  if (!/^\d{5}$/.test(zip)) return { error: "Enter a 5-digit zip." };
  setZip(zip);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}
