"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { connectFeed, disconnectFeed, setZip, getFeed } from "@/lib/feeds/store";
import { nowEastern } from "@/lib/kanban/time";

// Settings actions for the Home feeds (CC3 spec §1: connect each Google calendar; edit the saved
// zip). Connecting stores a stub OAuth token in the secret store; the real token arrives when Josh
// signs in on the Mac mini. No AI, no real outside call from here.

export async function connectCalendarAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const slug = String(formData.get("slug") || "");
  if (!getFeed(slug)) return;
  connectFeed(slug, nowEastern(), user.username);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function disconnectCalendarAction(formData: FormData): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const slug = String(formData.get("slug") || "");
  if (!getFeed(slug)) return;
  disconnectFeed(slug);
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
