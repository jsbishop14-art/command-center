"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setZip } from "@/lib/feeds/store";
import { resolveTarget, startConnect, disconnect } from "@/lib/feeds/connections";
import { nowEastern } from "@/lib/kanban/time";

// Settings actions for the Home feeds and Google connections (spec §1; handoff §7.3). "Connect"
// opens Google's own sign-in (the stub consent screen in CI / build sessions) and the OAuth
// callback stores the token; no real Google call is made from here or in a build session.

// Begin connecting a Google target (a calendar "cal:<slug>", "gmail" or "intake"). Saves a one-time
// state and redirects the browser to the consent screen; the callback finishes the connection.
export async function connectGoogleAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) redirect("/signin");
  const t = resolveTarget(String(formData.get("target") || ""));
  if (!t) return;
  const url = startConnect(t, user.username, nowEastern());
  redirect(url);
}

// Reconnect is the same flow; it exists as its own action so the Problems screen can label it.
export async function reconnectGoogleAction(formData: FormData): Promise<void> {
  return connectGoogleAction(formData);
}

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
