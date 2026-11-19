"use server";

import { redirect } from "next/navigation";
import { signOut, currentUser } from "@/lib/auth";
import { setBoard, isBoard } from "@/lib/prefs";
import { setSecret } from "@/lib/secrets";
import { revalidatePath } from "next/cache";

export async function signOutAction(): Promise<void> {
  signOut();
  redirect("/signin");
}

export async function setBoardAction(board: string): Promise<void> {
  const user = currentUser();
  if (!user) return;
  if (!isBoard(board)) return;
  setBoard(user.id, board);
  revalidatePath("/", "layout");
}

export type SecretSaveState = { ok?: boolean; error?: string; savedName?: string };

export async function saveSecretAction(
  _prev: SecretSaveState,
  formData: FormData,
): Promise<SecretSaveState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const name = String(formData.get("name") || "");
  const value = String(formData.get("value") || "");
  if (!value) return { error: "Enter a value to save." };
  try {
    setSecret(name, value, user.username);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  revalidatePath("/settings");
  return { ok: true, savedName: name };
}
