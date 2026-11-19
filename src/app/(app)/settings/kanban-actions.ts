"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { issueToken, revokeToken } from "@/lib/kanban/tokens";
import { setDuetEnabled } from "@/lib/kanban/state";
import { nowEastern } from "@/lib/kanban/time";
import type { TokenWriter } from "@/lib/kanban/types";

// Settings actions for the kanban action layer (handoff §4.8): issue/revoke a token per writer and
// flip the Duet on/off switch.

function requireUser() {
  const user = currentUser();
  if (!user) redirect("/signin");
  return user;
}

export type TokenState = { token?: string; writer?: string; error?: string };

export async function issueTokenAction(_prev: TokenState, formData: FormData): Promise<TokenState> {
  requireUser();
  const writer = String(formData.get("writer") || "") as TokenWriter;
  if (writer !== "claude" && writer !== "duet") return { error: "Unknown writer." };
  const token = issueToken(writer, nowEastern());
  revalidatePath("/settings");
  // The plaintext is returned once to show; it is never stored or shown again.
  return { token, writer };
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  requireUser();
  const writer = String(formData.get("writer") || "") as TokenWriter;
  if (writer === "claude" || writer === "duet") revokeToken(writer, nowEastern());
  revalidatePath("/settings");
}

export async function setDuetAction(formData: FormData): Promise<void> {
  requireUser();
  const on = String(formData.get("on") || "") === "1";
  setDuetEnabled(on);
  revalidatePath("/settings");
}
