"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setScoringConfig, SCORING_FIELDS, type ScoringConfig } from "@/lib/phone/config";

// Settings action for the phone-lookup scoring config (handoff §8.4, spec §3: one config file,
// editable in Settings). Both logins may tune it. No AI.

export type ScoringState = { ok?: boolean; error?: string };

export async function saveScoringAction(_prev: ScoringState, formData: FormData): Promise<ScoringState> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const next: Partial<ScoringConfig> = {};
  for (const f of SCORING_FIELDS) {
    const raw = formData.get(f.key);
    if (raw == null || String(raw).trim() === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) next[f.key] = Math.trunc(n);
  }
  setScoringConfig(next);
  revalidatePath("/settings");
  revalidatePath("/phone");
  return { ok: true };
}
