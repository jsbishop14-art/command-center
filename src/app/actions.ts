"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { setBoard, isBoard } from "@/lib/prefs";
import { currentUser } from "@/lib/auth";
import { setSecret } from "@/lib/secrets";
import { revalidatePath } from "next/cache";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { error: "Enter your username and password." };
  }
  const user = signIn(username, password);
  if (!user) {
    return { error: "That username or password is not right." };
  }
  redirect("/home");
}

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
