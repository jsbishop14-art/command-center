import { weekTokens, usage30Days } from "@/lib/sync/usage";
import type { DailyUsage } from "@/lib/sync/store";
import { listProjects } from "./projects";
import { budgetState } from "./budget";
import { deriveProject } from "./state";
import { updaterView } from "./updater";
import type {
  ActivityItem,
  BudgetState,
  BuildsAlerts,
  ProjectCard,
  Question,
  UsageTile,
} from "./types";

// Assemble the whole Builds screen (handoff §7.1, mockup Builds.dc.html): usage tiles, the budget
// tile, one card per project, the Needs-you panel, the dashboard-usage chart, recent activity and the
// alert counts the top-bar bell and the red Builds badge use (the touch screen in CC9 reads the same
// counts — spec §2). Everything is derived from the (stubbed) GitHub reads; no outside call, no AI.

const COMMAND_CENTER_REPO = "command-center";

export type NeedsYouItem =
  | {
      kind: "questions";
      project: string;
      repo: string;
      branch: string;
      buildName: string;
      questions: Question[]; // the unanswered ones, in order
      totalQuestions: number;
    }
  | {
      kind: "answers-saved";
      project: string;
      repo: string;
      buildName: string;
      answeredCount: number;
      runnerCommand: string;
    };

export type BuildsView = {
  projects: ProjectCard[];
  budget: BudgetState;
  usage: UsageTile[];
  needsYou: NeedsYouItem[];
  activity: ActivityItem[];
  dashboard30: DailyUsage[];
  alerts: BuildsAlerts;
};

function deriveAll(now: Date): { cards: ProjectCard[]; budget: BudgetState } {
  const budget = budgetState(now);
  const cards = listProjects().map((p) =>
    deriveProject(p, budget, now, p.repo === COMMAND_CENTER_REPO ? updaterView(p.repo) : undefined),
  );
  return { cards, budget };
}

function usageTiles(cards: ProjectCard[], now: Date): UsageTile[] {
  const inProgress = cards.filter((c) => c.stage === "Building" || c.stage === "Needs Josh").length;
  return [
    { key: "plan", label: "Weekly plan usage", note: "resets Mon 2:00 AM", value: "—", pct: null },
    { key: "fable", label: "Fable weekly limit", note: "separate limit", value: "—", pct: null },
    { key: "inprogress", label: "Builds in progress", note: "across projects", value: String(inProgress), pct: null },
    {
      key: "dashboard",
      label: "Command Center (dashboard)",
      note: "this week · Sync runs only",
      value: `${fmtTokens(weekTokens(now))} tok`,
      pct: null,
    },
  ];
}

function needsYou(cards: ProjectCard[]): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  for (const c of cards) {
    if (c.needsJosh && c.current) {
      const unanswered = c.current.questions.filter((q) => q.answer === null);
      out.push({
        kind: "questions",
        project: c.name,
        repo: c.repo,
        branch: c.current.branch ?? "",
        buildName: c.current.name,
        questions: unanswered,
        totalQuestions: c.current.questions.length,
      });
    } else if (c.answersSaved && c.current && c.runnerCommand) {
      out.push({
        kind: "answers-saved",
        project: c.name,
        repo: c.repo,
        buildName: c.current.name,
        answeredCount: c.current.questions.length,
        runnerCommand: c.runnerCommand,
      });
    }
  }
  return out;
}

function activity(cards: ProjectCard[], budget: BudgetState): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const c of cards) {
    if (c.rolledBack) {
      items.push({ at: c.rolledBack.at, text: `${c.name} · update failed its check, rolled back` });
    }
    if (c.needsJosh && c.current) {
      items.push({ at: c.lastActivityAt ?? "", text: `${c.name} · question posted` });
    } else if (c.answersSaved) {
      items.push({ at: c.lastActivityAt ?? "", text: `${c.name} · answers saved` });
    }
    if (c.lastLanded?.at) {
      items.push({ at: c.lastLanded.at, text: `${c.name} · ${c.lastLanded.name} landed` });
    }
  }
  if (budget.hold) {
    items.push({ at: "", text: `Build budget · HOLD at ${budget.pct ?? "—"}%` });
  } else if (budget.warn) {
    items.push({ at: "", text: `Build budget · warning at ${budget.pct ?? "—"}%` });
  }
  return items
    .sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0))
    .slice(0, 6);
}

export function alertsFrom(cards: ProjectCard[], budget: BudgetState): BuildsAlerts {
  const needsJosh = cards.filter((c) => c.needsJosh).length;
  const rolledBack = cards.some((c) => c.rolledBack !== null);
  const bell =
    needsJosh + (budget.warn ? 1 : 0) + (budget.hold ? 1 : 0) + (rolledBack ? 1 : 0);
  return { needsJosh: needsJosh + (rolledBack ? 1 : 0), bell, hold: budget.hold, warn: budget.warn, rolledBack };
}

// Cheap enough for the layout (all local reads), like the live-feed statuses.
export function buildsAlerts(now: Date = new Date()): BuildsAlerts {
  const { cards, budget } = deriveAll(now);
  return alertsFrom(cards, budget);
}

export function buildsView(now: Date = new Date()): BuildsView {
  const { cards, budget } = deriveAll(now);
  return {
    projects: cards,
    budget,
    usage: usageTiles(cards, now),
    needsYou: needsYou(cards),
    activity: activity(cards, budget),
    dashboard30: usage30Days(),
    alerts: alertsFrom(cards, budget),
  };
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
