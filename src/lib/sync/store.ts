import { getDb } from "@/lib/db";

// Database side of Sync bookkeeping (migration 0007): the run, its per-item usage, and every change
// it made for the results list and Revert (handoff §5.1, §5.4, §5.5). Single household, no AI here.

export type SyncItemKey = "inbox" | "kanban" | "schedule";

export type SyncChangeRow = {
  runId: string;
  seq: number;
  kind: SyncItemKey;
  target: string;
  label: string;
  sub: string;
  action: string; // "Revert" | "Withdraw"
  payload: unknown | null;
  revertedAt: string | null;
};

export type SyncRunItemRow = {
  item: SyncItemKey;
  model: string;
  tokens: number;
  count: number;
  at: string;
};

export type SyncRun = {
  id: string;
  items: SyncItemKey[];
  skipped: SyncItemKey[];
  by: string;
  totalTokens: number;
  startedAt: string;
  finishedAt: string | null;
  runItems: SyncRunItemRow[];
  changes: SyncChangeRow[];
};

export function createRun(args: {
  id: string;
  by: string;
  items: SyncItemKey[];
  skipped: SyncItemKey[];
  startedAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO sync_runs (id, items, skipped, by, total_tokens, started_at)
       VALUES (@id, @items, @skipped, @by, 0, @startedAt)`,
    )
    .run({
      id: args.id,
      items: JSON.stringify(args.items),
      skipped: JSON.stringify(args.skipped),
      by: args.by,
      startedAt: args.startedAt,
    });
}

export function addRunItem(
  runId: string,
  item: SyncItemKey,
  model: string,
  tokens: number,
  count: number,
  at: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO sync_run_items (run_id, item, model, tokens, count, at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(runId, item, model, tokens, count, at);
}

export function addChange(args: {
  runId: string;
  seq: number;
  kind: SyncItemKey;
  target: string;
  label: string;
  sub?: string;
  action: string;
  payload?: unknown;
}): void {
  getDb()
    .prepare(
      `INSERT INTO sync_changes (run_id, seq, kind, target, label, sub, action, payload)
       VALUES (@runId, @seq, @kind, @target, @label, @sub, @action, @payload)`,
    )
    .run({
      runId: args.runId,
      seq: args.seq,
      kind: args.kind,
      target: args.target,
      label: args.label,
      sub: args.sub ?? "",
      action: args.action,
      payload: args.payload === undefined ? null : JSON.stringify(args.payload),
    });
}

export function finishRun(runId: string, totalTokens: number, finishedAt: string): void {
  getDb()
    .prepare("UPDATE sync_runs SET total_tokens = ?, finished_at = ? WHERE id = ?")
    .run(totalTokens, finishedAt, runId);
}

export function markReverted(runId: string, seq: number, at: string): void {
  getDb()
    .prepare("UPDATE sync_changes SET reverted_at = ? WHERE run_id = ? AND seq = ? AND reverted_at IS NULL")
    .run(at, runId, seq);
}

type RunRow = {
  id: string;
  items: string;
  skipped: string;
  by: string;
  total_tokens: number;
  started_at: string;
  finished_at: string | null;
};

function parseList(json: string): SyncItemKey[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as SyncItemKey[]) : [];
  } catch {
    return [];
  }
}

function changesFor(runId: string): SyncChangeRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM sync_changes WHERE run_id = ? ORDER BY seq")
    .all(runId) as {
    run_id: string;
    seq: number;
    kind: string;
    target: string;
    label: string;
    sub: string;
    action: string;
    payload: string | null;
    reverted_at: string | null;
  }[];
  return rows.map((r) => ({
    runId: r.run_id,
    seq: r.seq,
    kind: r.kind as SyncItemKey,
    target: r.target,
    label: r.label,
    sub: r.sub,
    action: r.action,
    payload: r.payload ? JSON.parse(r.payload) : null,
    revertedAt: r.reverted_at,
  }));
}

function itemsFor(runId: string): SyncRunItemRow[] {
  const rows = getDb()
    .prepare("SELECT item, model, tokens, count, at FROM sync_run_items WHERE run_id = ? ORDER BY item")
    .all(runId) as { item: string; model: string; tokens: number; count: number; at: string }[];
  return rows.map((r) => ({
    item: r.item as SyncItemKey,
    model: r.model,
    tokens: r.tokens,
    count: r.count,
    at: r.at,
  }));
}

function toRun(r: RunRow): SyncRun {
  return {
    id: r.id,
    items: parseList(r.items),
    skipped: parseList(r.skipped),
    by: r.by,
    totalTokens: r.total_tokens,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    runItems: itemsFor(r.id),
    changes: changesFor(r.id),
  };
}

export function getRun(id: string): SyncRun | null {
  const r = getDb().prepare("SELECT * FROM sync_runs WHERE id = ?").get(id) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function getChange(runId: string, seq: number): SyncChangeRow | null {
  return changesFor(runId).find((c) => c.seq === seq) ?? null;
}

export function lastRun(): SyncRun | null {
  const r = getDb()
    .prepare("SELECT * FROM sync_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC, id DESC LIMIT 1")
    .get() as RunRow | undefined;
  return r ? toRun(r) : null;
}

// Tokens spent on Sync since `sinceIso` (handoff §5.5 "dashboard tokens this week" = rolling 7 days).
export function tokensSince(sinceIso: string): number {
  const r = getDb()
    .prepare("SELECT COALESCE(SUM(tokens), 0) AS t FROM sync_run_items WHERE at >= ?")
    .get(sinceIso) as { t: number };
  return r.t;
}

export type DailyUsage = { date: string; inbox: number; kanban: number; schedule: number };

// Tokens per day, split by item, for the last 30 days (handoff §5.5 usage panel). Dates are the
// Eastern calendar date of each run item (the stored `at` is an Eastern timestamp).
export function dailyUsageSince(fromDate: string): DailyUsage[] {
  const rows = getDb()
    .prepare(
      `SELECT substr(at, 1, 10) AS d, item, SUM(tokens) AS t
       FROM sync_run_items WHERE substr(at, 1, 10) >= ?
       GROUP BY d, item ORDER BY d`,
    )
    .all(fromDate) as { d: string; item: string; t: number }[];
  const byDate = new Map<string, DailyUsage>();
  for (const r of rows) {
    const day = byDate.get(r.d) ?? { date: r.d, inbox: 0, kanban: 0, schedule: 0 };
    if (r.item === "inbox" || r.item === "kanban" || r.item === "schedule") day[r.item] = r.t;
    byDate.set(r.d, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
