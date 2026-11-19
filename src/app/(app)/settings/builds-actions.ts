"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setProjects } from "@/lib/builds/projects";
import { commitBudget } from "@/lib/builds/writer";
import { DEFAULT_WARN_PCT } from "@/lib/builds/budget";
import { DisallowedWriteError } from "@/lib/builds/github";
import type { Project } from "@/lib/builds/types";

// Settings → Software builds (handoff §7.1): edit the tracked projects (name + repo; a local list)
// and the build budget limit and warning percentage (written to build-control/budget.json). Both
// logins may change settings (handoff §1.1). Signed-out callers are refused.

export async function saveBuildProjectsAction(
  _: unknown,
  formData: FormData,
): Promise<{ ok: boolean }> {
  if (!currentUser()) return { ok: false };
  const names = formData.getAll("name").map(String);
  const repos = formData.getAll("repo").map(String);
  const projects: Project[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] ?? "").trim();
    const repo = (repos[i] ?? "").trim();
    if (name && repo) projects.push({ name, repo });
  }
  setProjects(projects);
  revalidatePath("/settings");
  revalidatePath("/builds");
  return { ok: true };
}

export type BudgetSettingsResult = { ok: true } | { error: string };

export async function saveBuildBudgetAction(
  _: unknown,
  formData: FormData,
): Promise<BudgetSettingsResult> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const limitRaw = String(formData.get("weekly_limit_tokens") ?? "").trim();
  const warnRaw = String(formData.get("warn_pct") ?? "").trim();

  let weeklyLimitTokens: number | null = null;
  if (limitRaw.length > 0) {
    const n = Number(limitRaw.replace(/[,_\s]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return { error: "The weekly limit must be a positive number of tokens, or blank." };
    weeklyLimitTokens = Math.round(n);
  }
  let warnPct = DEFAULT_WARN_PCT;
  if (warnRaw.length > 0) {
    const n = Number(warnRaw);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return { error: "The warning percentage must be between 1 and 100." };
    warnPct = Math.round(n);
  }

  try {
    commitBudget({ weeklyLimitTokens, warnPct }, user.display_name);
  } catch (e) {
    if (e instanceof DisallowedWriteError) return { error: e.message };
    throw e;
  }
  revalidatePath("/settings");
  revalidatePath("/builds");
  return { ok: true };
}
