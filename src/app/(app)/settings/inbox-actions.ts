"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { connectGmail, disconnectGmail, setIntakeAddress, setNudgeTemplate, DEFAULT_TEMPLATE_B } from "@/lib/feeds/gmail";
import { issueShortcutToken, revokeShortcutToken } from "@/lib/shortcut";
import { nowEastern } from "@/lib/kanban/time";

// Settings actions for Inbox & email (handoff §2, §2.1, §7.3, §8.7, spec §1). Connect Gmail, set
// the intake address, edit template B, and issue/revoke the iPhone Shortcut token. No real outside
// call here: connecting Gmail only records the connection (the real sign-in is done on the Mac
// mini, handoff "What waits on Josh"). The app never sends email.

function requireUser() {
  const user = currentUser();
  if (!user) redirect("/signin");
  return user;
}

function revalidate() {
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/home");
}

export async function connectGmailAction(): Promise<void> {
  requireUser();
  connectGmail(nowEastern());
  revalidate();
}

export async function disconnectGmailAction(): Promise<void> {
  requireUser();
  disconnectGmail();
  revalidate();
}

export type SaveState = { ok?: boolean; error?: string };

export async function saveIntakeAddressAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  requireUser();
  const addr = String(formData.get("intake") || "").trim();
  // A permissive check: an address with a single @ and a dot in the domain. The field is free text
  // because the intake mailbox may be a plus-address or a new account (spec §7, CC4-ASK-1).
  if (addr && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return { error: "Enter a valid email address." };
  setIntakeAddress(addr);
  revalidate();
  return { ok: true };
}

export async function saveTemplateAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  requireUser();
  const text = String(formData.get("template") || "").trim();
  if (!text) return { error: "The template cannot be empty." };
  if (!/thanks,\s*$/i.test(text)) return { error: 'Template B must end at "Thanks," (Gmail adds your signature).' };
  setNudgeTemplate(text);
  revalidate();
  return { ok: true };
}

export async function resetTemplateAction(): Promise<void> {
  requireUser();
  setNudgeTemplate(DEFAULT_TEMPLATE_B);
  revalidate();
}

export type ShortcutTokenState = { token?: string; error?: string };

export async function issueShortcutTokenAction(_prev: ShortcutTokenState): Promise<ShortcutTokenState> {
  requireUser();
  const token = issueShortcutToken(nowEastern());
  revalidate();
  return { token };
}

export async function revokeShortcutTokenAction(): Promise<void> {
  requireUser();
  revokeShortcutToken();
  revalidate();
}
