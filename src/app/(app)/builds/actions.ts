"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { nowEastern } from "@/lib/kanban/time";
import { listProjects } from "@/lib/builds/projects";
import { budgetState, nextResetStamp } from "@/lib/builds/budget";
import { deriveProject } from "@/lib/builds/state";
import { commitAnswer, commitBudget, AnswerError } from "@/lib/builds/writer";
import { DisallowedWriteError } from "@/lib/builds/github";

// Server actions behind the Builds screen (handoff §7.1). Only two things reach GitHub: answers (a
// status file + chain.md on the build branch, one commit, [skip ci]) and the build budget override
// (budget.json). The app never starts the runner and has no "Approve and merge" (spec §3). Signed-out
// callers are refused; both logins (Josh and Christine) may act (handoff §1.1).

export type SubmitResult = { ok: true; remaining: number; runnerCommand: string | null } | { error: string };

export async function submitAnswerAction(input: {
  repo: string;
  branch: string;
  buildName: string;
  questionId: string;
  questionNumber: number;
  answer: string;
}): Promise<SubmitResult> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const answer = input.answer.trim();
  if (!answer) return { error: "Type an answer or pick an option." };
  try {
    commitAnswer({
      repo: input.repo,
      branch: input.branch,
      buildName: input.buildName,
      questionId: input.questionId,
      questionNumber: input.questionNumber,
      by: user.display_name,
      // Eastern date-time in the chain-ruling style ("2026-11-09 13:05"), not raw ISO (handoff §7.1).
      at: nowEastern().slice(0, 16).replace("T", " "),
      answer,
    });
  } catch (e) {
    if (e instanceof AnswerError || e instanceof DisallowedWriteError) return { error: e.message };
    throw e;
  }
  revalidatePath("/builds");
  revalidatePath("/", "layout");
  // Re-derive the project so the panel can advance or show the runner command.
  const project = listProjects().find((p) => p.repo === input.repo);
  let remaining = 0;
  let runnerCommand: string | null = null;
  if (project) {
    const card = deriveProject(project, budgetState());
    remaining = card.unansweredCount;
    runnerCommand = card.runnerCommand;
  }
  return { ok: true, remaining, runnerCommand };
}

export type OverrideResult = { ok: true; overrideUntil: string } | { error: string };

// Override the build-budget hold until a time Josh chooses (default: the next Monday 2:00 AM reset).
// Writes override_until to budget.json; the next runner start then proceeds (process.md §12, check 5).
export async function overrideBudgetAction(): Promise<OverrideResult> {
  const user = currentUser();
  if (!user) return { error: "Sign in first." };
  const until = nextResetStamp();
  try {
    commitBudget({ overrideUntil: until }, user.display_name);
  } catch (e) {
    if (e instanceof DisallowedWriteError) return { error: e.message };
    throw e;
  }
  revalidatePath("/builds");
  revalidatePath("/", "layout");
  return { ok: true, overrideUntil: until };
}
