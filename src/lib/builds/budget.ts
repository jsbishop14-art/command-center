import { easternStamp } from "@/lib/kanban/time";
import { readFile, BUILD_CONTROL_REPO } from "./github";
import type { BudgetState } from "./types";

// The build budget (process.md §12, handoff §7.1). A weekly limit across every project's runner,
// reset Monday 2:00 AM Eastern. The tile shows this week's usage against the limit and whether the
// hold is on; it covers builds only, not Command Center's Sync usage (Josh, 2026-11-09 15:14). All
// of this reads build-control/budget.json and build-control/usage.jsonl from GitHub (stubbed).

export const DEFAULT_WARN_PCT = 80;

type BudgetConfig = { weekly_limit_tokens: number | null; warn_pct: number; override_until: string | null };

export function readBudgetConfig(): BudgetConfig | null {
  const raw = readFile(BUILD_CONTROL_REPO, "main", "budget.json");
  if (raw === null) return null; // build-control not set up → "Budget not set up"
  try {
    const v = JSON.parse(raw) as Partial<BudgetConfig>;
    const limit =
      typeof v.weekly_limit_tokens === "number" && v.weekly_limit_tokens > 0 ? v.weekly_limit_tokens : null;
    const warn = typeof v.warn_pct === "number" && v.warn_pct > 0 ? v.warn_pct : DEFAULT_WARN_PCT;
    const override = typeof v.override_until === "string" ? v.override_until : null;
    return { weekly_limit_tokens: limit, warn_pct: warn, override_until: override };
  } catch {
    return { weekly_limit_tokens: null, warn_pct: DEFAULT_WARN_PCT, override_until: null };
  }
}

// The Eastern wall-clock string of the most recent Monday 2:00 AM reset at or before `now`. Usage is
// summed from this boundary. Wall-clock comparison is DST-safe and is exactly what the reset means.
export function weekResetWall(now: Date = new Date()): string {
  const wall = easternStamp(now); // YYYY-MM-DDTHH:MM:SS±HH:MM
  const y = Number(wall.slice(0, 4));
  const mo = Number(wall.slice(5, 7));
  const d = Number(wall.slice(8, 10));
  const hour = Number(wall.slice(11, 13));
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
  let daysSinceMon = (dow + 6) % 7;
  if (daysSinceMon === 0 && hour < 2) daysSinceMon = 7; // Monday before 2 AM → last Monday
  const resetDate = new Date(Date.UTC(y, mo - 1, d) - daysSinceMon * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return `${resetDate}T02:00:00`;
}

// The next Monday 2:00 AM reset after `now`, as an Eastern timestamp with offset (the default
// override end — process.md §12, mockup "Clears Mon 2:00 AM").
export function nextResetStamp(now: Date = new Date()): string {
  const thisResetDate = weekResetWall(now).slice(0, 10);
  const nextDate = new Date(`${thisResetDate}T00:00:00Z`).getTime() + 7 * 86_400_000;
  const nextYMD = new Date(nextDate).toISOString().slice(0, 10);
  const offset = easternStamp(now).slice(19); // ±HH:MM
  // Re-express with the correct offset at that instant (DST may differ from now's).
  return easternStamp(new Date(`${nextYMD}T02:00:00${offset}`));
}

// Sum this week's `tokens` from usage.jsonl (process.md §12: input + cache-creation + output; cache
// reads are recorded but not counted). An entry counts when its Eastern wall-clock time is at or
// after the reset boundary.
export function usedThisWeek(now: Date = new Date()): number {
  const raw = readFile(BUILD_CONTROL_REPO, "main", "usage.jsonl");
  if (!raw) return 0;
  const boundary = weekResetWall(now);
  let total = 0;
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const row = JSON.parse(s) as { at?: string; tokens?: number };
      if (!row.at || typeof row.tokens !== "number") continue;
      const wall = easternStamp(new Date(row.at)).slice(0, 19);
      if (wall >= boundary) total += row.tokens;
    } catch {
      // ignore a malformed line
    }
  }
  return total;
}

export function overrideActive(cfg: BudgetConfig, now: Date = new Date()): boolean {
  if (!cfg.override_until) return false;
  const until = new Date(cfg.override_until).getTime();
  return Number.isFinite(until) && now.getTime() < until;
}

export function budgetState(now: Date = new Date()): BudgetState {
  const cfg = readBudgetConfig();
  if (!cfg) {
    return {
      configured: false,
      limit: null,
      warnPct: DEFAULT_WARN_PCT,
      usedThisWeek: 0,
      pct: null,
      hold: false,
      warn: false,
      overrideUntil: null,
      overrideActive: false,
    };
  }
  const used = usedThisWeek(now);
  const limit = cfg.weekly_limit_tokens;
  const ovr = overrideActive(cfg, now);
  const atOrOverLimit = limit !== null && used >= limit;
  const hold = atOrOverLimit && !ovr;
  const warn = limit !== null && !hold && used >= (limit * cfg.warn_pct) / 100;
  return {
    configured: true,
    limit,
    warnPct: cfg.warn_pct,
    usedThisWeek: used,
    pct: limit !== null ? Math.round((used / limit) * 100) : null,
    hold,
    warn,
    overrideUntil: cfg.override_until,
    overrideActive: ovr,
  };
}
