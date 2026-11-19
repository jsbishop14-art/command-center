import { getDb } from "@/lib/db";
import type { Actor } from "@/lib/kanban/types";
import { DEAL_MEANINGFUL, dealFields, type Deal, type DealFields } from "./types";

// Deal history and Revert (handoff §3.3 history panel, §5.4). Every deal write records one
// deal_changes row holding the before/after of the changed fields, so a Claude or Duet change can
// be reverted to its earlier values (spec check 2). Only the app writes these rows (CLAUDE §6).

export type DealAction = "create" | "edit" | "archive" | "restore" | "revert";

export type DealChange = {
  id: number;
  dealId: number;
  at: string;
  actor: Actor;
  action: DealAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  run: string | null;
  undoes: number | null;
};

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type DealDiff = { changed: string[]; before: Record<string, unknown>; after: Record<string, unknown> };

// Field-level diff between a before snapshot (or null for a new deal) and the deal now.
export function diffDeal(before: DealFields | null, deal: Deal): DealDiff {
  const now = dealFields(deal);
  const changed: string[] = [];
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const f of DEAL_MEANINGFUL) {
    const bv = before ? (before as Record<string, unknown>)[f] : undefined;
    const av = (now as Record<string, unknown>)[f];
    if (!before || !eq(bv, av)) {
      changed.push(f);
      if (before) b[f] = bv;
      a[f] = av;
    }
  }
  return { changed, before: b, after: a };
}

function classify(before: DealFields | null, diff: DealDiff): DealAction {
  if (!before) return "create";
  if (diff.changed.includes("archivedAt")) {
    // archivedAt moved from a value to null => restore; from null to a value => archive.
    return diff.after.archivedAt ? "archive" : "restore";
  }
  return "edit";
}

// Record a deal change. Returns the written row, or null when nothing meaningful changed.
export function logDealChange(args: {
  before: DealFields | null;
  deal: Deal;
  actor: Actor;
  at: string;
  run?: string | null;
  forceAction?: DealAction;
  undoes?: number;
}): DealChange | null {
  const diff = diffDeal(args.before, args.deal);
  if (args.before && diff.changed.length === 0) return null;
  const action = args.forceAction ?? classify(args.before, diff);
  const info = getDb()
    .prepare(
      `INSERT INTO deal_changes (deal_id, at, actor, action, before, after, run, undoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.deal.id,
      args.at,
      args.actor,
      action,
      args.before ? JSON.stringify(diff.before) : null,
      JSON.stringify(diff.after),
      args.run ?? null,
      args.undoes ?? null,
    );
  return {
    id: Number(info.lastInsertRowid),
    dealId: args.deal.id,
    at: args.at,
    actor: args.actor,
    action,
    before: args.before ? diff.before : null,
    after: diff.after,
    run: args.run ?? null,
    undoes: args.undoes ?? null,
  };
}

type ChangeRow = {
  id: number;
  deal_id: number;
  at: string;
  actor: string;
  action: string;
  before: string | null;
  after: string | null;
  run: string | null;
  undoes: number | null;
};

function rowToChange(r: ChangeRow): DealChange {
  return {
    id: r.id,
    dealId: r.deal_id,
    at: r.at,
    actor: r.actor as Actor,
    action: r.action as DealAction,
    before: r.before ? (JSON.parse(r.before) as Record<string, unknown>) : null,
    after: r.after ? (JSON.parse(r.after) as Record<string, unknown>) : null,
    run: r.run,
    undoes: r.undoes,
  };
}

// A deal's changes, oldest first.
export function readDealChanges(dealId: number): DealChange[] {
  const rows = getDb()
    .prepare("SELECT * FROM deal_changes WHERE deal_id = ? ORDER BY id")
    .all(dealId) as ChangeRow[];
  return rows.map(rowToChange);
}

export function findDealChange(id: number): DealChange | null {
  const r = getDb().prepare("SELECT * FROM deal_changes WHERE id = ?").get(id) as ChangeRow | undefined;
  return r ? rowToChange(r) : null;
}
