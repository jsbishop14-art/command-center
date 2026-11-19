import { easternStamp, todayEastern } from "@/lib/kanban/time";
import { getAppSetting } from "@/lib/ezbinder/store";
import { lastRun, tokensSince, dailyUsageSince, type DailyUsage } from "./store";
import { addDays } from "@/lib/ezbinder/dates";

// Sync usage read model (handoff §5.5). Feeds the three tiles on the Sync popup — last Sync tokens,
// dashboard tokens this week, weekly plan % — and the 30-day chart split by item. Chat and Duet
// usage happen outside the app and are not counted here (§5.5). No AI.

export const PLAN_SETTING = "ai_weekly_plan_tokens";

export type UsageSummary = {
  lastRunTokens: number | null;
  weekTokens: number;
  planTokens: number | null;
  planPct: number | null;
};

// Tokens the most recent finished run used (null when no run yet).
export function lastRunTokens(): number | null {
  const r = lastRun();
  return r ? r.totalTokens : null;
}

// Dashboard tokens "this week" = rolling 7 days (handoff §5.5). Sum of Sync run-item tokens.
export function weekTokens(now: Date = new Date()): number {
  const since = easternStamp(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return tokensSince(since);
}

// The weekly plan figure is an estimate; the Max plan has no hard cap on Sync (§5.6). Josh can set
// ai_weekly_plan_tokens in Settings for a plan %; until then the % is null and the tile shows "—".
export function weeklyPlanTokens(): number | null {
  const v = getAppSetting(PLAN_SETTING);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function usageSummary(now: Date = new Date()): UsageSummary {
  const week = weekTokens(now);
  const plan = weeklyPlanTokens();
  return {
    lastRunTokens: lastRunTokens(),
    weekTokens: week,
    planTokens: plan,
    planPct: plan ? Math.round((week / plan) * 100) : null,
  };
}

// Tokens per day for the last 30 days, split by item, with every day present (zero-filled) so the
// chart has a bar slot for each day (handoff §5.5 usage panel).
export function usage30Days(today: string = todayEastern()): DailyUsage[] {
  const from = addDays(today, -29);
  const have = new Map(dailyUsageSince(from).map((d) => [d.date, d]));
  const out: DailyUsage[] = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(from, i);
    out.push(have.get(date) ?? { date, inbox: 0, kanban: 0, schedule: 0 });
  }
  return out;
}
