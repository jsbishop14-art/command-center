"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { nowEastern } from "@/lib/kanban/time";
import { runLookup, PhoneInputError } from "@/lib/phone/lookup";
import { normalizePhone } from "@/lib/phone/normalize";
import { setMark, removeMark } from "@/lib/phone/store";

// Server actions for the Phone lookup screen (handoff §8.6). Josh and Christine both use the
// screen; each action runs as the signed-in user so history and marks are attributed correctly.
// No AI, no real outside call (the stub stands in off the Mac mini). The desktop screen uses these
// actions; the iPhone Shortcut uses the token-gated API routes under /api/phone (§8.7).

function actor(): "josh" | "christine" {
  const user = currentUser();
  if (!user) redirect("/signin");
  return user.role;
}

// Run a lookup from the number box. On success, land on the result (?sel=10digits); on an
// unrecognized number, come back with an error and the typed text preserved.
export async function lookupAction(formData: FormData): Promise<void> {
  const who = actor();
  const raw = String(formData.get("phone") || "");
  try {
    const r = await runLookup({ input: raw, source: "desktop", user: who, at: nowEastern() });
    revalidatePath("/phone");
    redirect(`/phone?sel=${r.phone}`);
  } catch (e) {
    if (e instanceof PhoneInputError) {
      redirect(`/phone?err=1&n=${encodeURIComponent(raw)}`);
    }
    throw e;
  }
}

// Force a fresh paid Twilio lookup (handoff §8.6 Refresh button).
export async function refreshAction(formData: FormData): Promise<void> {
  const who = actor();
  const phone = String(formData.get("phone") || "");
  const norm = normalizePhone(phone);
  if (!norm) redirect("/phone");
  await runLookup({ input: norm!.phone, source: "desktop", user: who, refresh: true, at: nowEastern() });
  revalidatePath("/phone");
  redirect(`/phone?sel=${norm!.phone}`);
}

// Mark spam / real (shared between both users, handoff §8.4). A single form carries the optional
// note and two submit buttons whose value is the label.
export async function markAction(formData: FormData): Promise<void> {
  const who = actor();
  const norm = normalizePhone(String(formData.get("phone") || ""));
  const label = String(formData.get("label") || "");
  if (!norm || (label !== "spam" && label !== "real")) redirect("/phone");
  const note = String(formData.get("note") || "").trim();
  setMark(norm!.phone, label as "spam" | "real", who, note, nowEastern());
  revalidatePath("/phone");
  redirect(`/phone?sel=${norm!.phone}`);
}

// Remove a mark; scoring resumes on the next lookup (handoff §8.4).
export async function unmarkAction(formData: FormData): Promise<void> {
  actor();
  const norm = normalizePhone(String(formData.get("phone") || ""));
  if (!norm) redirect("/phone");
  removeMark(norm!.phone);
  revalidatePath("/phone");
  redirect(`/phone?sel=${norm!.phone}`);
}
