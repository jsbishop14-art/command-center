// Types for the Builds screen (handoff §7.1, spec §1). The four build stages come from GitHub:
// Queued, Building, Needs Josh, Landed (chain.md ruling 2026-11-09 15:19 answer 3).
export const STAGES = ["Queued", "Building", "Needs Josh", "Landed"] as const;
export type Stage = (typeof STAGES)[number];

// A tracked project and its GitHub repo (handoff §7.1: "Each entry in Settings is a name and its
// GitHub repo; the list is editable").
export type Project = { name: string; repo: string };

// One entry in a project's chain (handoff §7.1: BUILDS in scripts/run_chain.py on docs/next-builds).
// The runner knows each build's branch name up front, so "Building: the build's branch exists" is a
// branchExists check on this branch; a Queued build is simply one whose branch does not exist yet.
export type ChainEntry = { name: string; branch: string };

// One option of a build question, in process.md §5 shape.
export type QuestionOption = { key: string; text: string };

// A question parsed from a build's status file Questions section (process.md §5 / CLAUDE §5). id is
// the [NAME-ASK-n] tag. answer is null until Josh answers on the dashboard (handoff §7.1).
export type Question = {
  id: string;
  number: number;
  text: string;
  options: QuestionOption[];
  recommendation: string;
  answer: { by: string; at: string; text: string } | null;
};

// A commit on the modelled GitHub.
export type Commit = {
  sha: string;
  message: string;
  author: string;
  committedAt: string;
  paths: string[];
};

// One build in a project's chain.
export type Build = {
  name: string;
  position: number; // 1-based place in the chain
  stage: Stage;
  landed: boolean;
  mergeSha: string | null;
  mergeAt: string | null;
  branch: string | null;
  lastActivityAt: string | null;
  pickUpHere: string | null;
  questions: Question[];
  heldByBudget: boolean; // Queued and the budget hold would stop it starting
};

// A project card on the Builds screen (handoff §7.1 "One card per project").
export type ProjectCard = {
  name: string;
  repo: string;
  landedCount: number;
  totalCount: number;
  current: Build | null; // the build in flight (or the next queued one)
  stage: Stage | "Queued · held by budget";
  queueLabel: string; // "3 of 10 builds landed"
  lastLanded: { name: string; at: string | null } | null;
  lastActivityAt: string | null;
  noActivityHours: number | null; // set when Building with no commit for 3h+ (handoff §7.1)
  needsJosh: boolean;
  unansweredCount: number;
  answersSaved: boolean; // all questions answered, waiting for the runner
  runnerCommand: string | null;
  live: { merge: string; at: string | null } | null; // Command Center only (handoff §7.4 step 8)
  rolledBack: { at: string; message: string; log: string } | null;
};

// The build budget tile (handoff §7.1, process.md §12). weekly covers builds only, not Sync usage.
export type BudgetState = {
  configured: boolean; // build-control repo present (false → "Budget not set up")
  limit: number | null;
  warnPct: number;
  usedThisWeek: number;
  pct: number | null; // null when no limit set
  hold: boolean; // at/over limit and no override in force
  warn: boolean; // at/over the warn level and not yet HOLD
  overrideUntil: string | null;
  overrideActive: boolean;
};

export type UsageTile = {
  key: string;
  label: string;
  note: string;
  value: string;
  pct: number | null;
};

export type ActivityItem = { at: string; text: string };

// Alert counts the top bar bell and the red Builds badge use (handoff §7.1 notifications); the touch
// screen (CC9) reads the same data (spec §2).
export type BuildsAlerts = {
  needsJosh: number; // projects awaiting an answer → red Builds badge
  bell: number; // needsJosh + budget warn + hold + rollback → top-bar bell count
  hold: boolean;
  warn: boolean;
  rolledBack: boolean;
};
