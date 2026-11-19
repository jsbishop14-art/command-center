import { nowEastern } from "@/lib/kanban/time";
import { ActionError } from "@/lib/kanban/actions-layer";
import { BOARDS, type Board, type Actor } from "@/lib/kanban/types";
import {
  getDealRow,
  listDealRows,
  searchDeals,
  insertDealRow,
  writeDealRow,
  linkEstimateRow,
  unlinkEstimateRow,
  type NewDealRow,
} from "./store";
import { logDealChange, readDealChanges, findDealChange, type DealChange } from "./history";
import { DEAL_TYPES, dealFields, isStageFor, type Deal, type DealType } from "./types";

// The deal action layer (handoff §4.8: "Deals always go through the action layer"; spec §3: Claude
// and Duet never change deals in the database directly). Josh and Christine reach these through the
// app UI; Claude and Duet reach update_deal / read_deal through the tokened route. Every write logs
// a deal_changes row (history + Revert, §3.3, §5.4).

export { ActionError };

function reload(id: number): Deal {
  const d = getDealRow(id);
  if (!d) throw new ActionError("not_found", `deal ${id} not found`);
  return d;
}

export function readDeal(id: number): Deal {
  return reload(id);
}

export function listDeals(opts?: { includeArchived?: boolean }): Deal[] {
  return listDealRows(opts);
}

export function searchDealList(query: string): Deal[] {
  return searchDeals(query);
}

function validType(type: string): DealType {
  if (!(DEAL_TYPES as readonly string[]).includes(type)) {
    throw new ActionError("bad_request", `invalid deal type: ${type}`);
  }
  return type as DealType;
}

function validBoards(boards: string[]): Board[] {
  const out = boards.filter((b) => (BOARDS as readonly string[]).includes(b)) as Board[];
  if (out.length !== boards.length) throw new ActionError("bad_request", "invalid board in list");
  if (out.length === 0) throw new ActionError("bad_request", "a deal must show on at least one board");
  return out;
}

export type CreateDealInput = {
  name: string;
  type: string;
  stage?: string;
  value?: number | null;
  probability?: number | null;
  currentTask?: string;
  nextAction?: string;
  nextActionDate?: string | null;
  notes?: string;
  boards?: string[];
  customerId?: string | null;
  jobId?: string | null;
};

export function createDeal(actor: Actor, input: CreateDealInput, opts?: { at?: string; run?: string }): Deal {
  const at = opts?.at ?? nowEastern();
  if (!input.name || !input.name.trim()) throw new ActionError("bad_request", "name is required");
  const type = validType(input.type);
  const stage = input.stage ?? (type === "sale" ? "Lead" : "Due diligence");
  if (!isStageFor(type, stage)) throw new ActionError("bad_request", `invalid ${type} stage: ${stage}`);
  const boards = input.boards ? validBoards(input.boards) : (["josh"] as Board[]);
  const row: NewDealRow = {
    name: input.name.trim(),
    type,
    stage,
    value: input.value ?? null,
    probability: input.probability ?? null,
    currentTask: input.currentTask ?? "",
    nextAction: input.nextAction ?? "",
    nextActionDate: input.nextActionDate ?? null,
    notes: input.notes ?? "",
    boards,
    customerId: input.customerId ?? null,
    jobId: input.jobId ?? null,
  };
  const id = insertDealRow(row, actor, at, opts?.run ?? null);
  const deal = reload(id);
  logDealChange({ before: null, deal, actor, at, run: opts?.run });
  return deal;
}

export type UpdateDealInput = {
  name?: string;
  type?: string;
  stage?: string;
  value?: number | null;
  probability?: number | null;
  currentTask?: string;
  nextAction?: string;
  nextActionDate?: string | null;
  notes?: string;
  boards?: string[];
  customerId?: string | null;
  jobId?: string | null;
};

export function updateDeal(actor: Actor, id: number, input: UpdateDealInput, opts?: { at?: string; run?: string }): Deal {
  const at = opts?.at ?? nowEastern();
  const current = reload(id);
  const before = dealFields(current);

  const patch: Partial<Deal> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new ActionError("bad_request", "name cannot be empty");
    patch.name = input.name.trim();
  }
  const nextType = input.type !== undefined ? validType(input.type) : current.type;
  if (input.type !== undefined) patch.type = nextType;
  if (input.stage !== undefined || input.type !== undefined) {
    const nextStage = input.stage ?? current.stage;
    if (!isStageFor(nextType, nextStage)) {
      throw new ActionError("bad_request", `invalid ${nextType} stage: ${nextStage}`);
    }
    patch.stage = nextStage;
  }
  if (input.value !== undefined) patch.value = input.value;
  if (input.probability !== undefined) patch.probability = input.probability;
  if (input.currentTask !== undefined) patch.currentTask = input.currentTask;
  if (input.nextAction !== undefined) patch.nextAction = input.nextAction;
  if (input.nextActionDate !== undefined) patch.nextActionDate = input.nextActionDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.boards !== undefined) patch.boards = validBoards(input.boards);
  if (input.customerId !== undefined) patch.customerId = input.customerId;
  if (input.jobId !== undefined) patch.jobId = input.jobId;

  writeDealRow(id, patch, actor, at, opts?.run ?? null);
  const deal = reload(id);
  logDealChange({ before, deal, actor, at, run: opts?.run });
  return deal;
}

// Archive / restore a deal. Archived deals are hidden from Projects and the open view but still
// found by search (handoff §3.3, spec §3). Logged so the panel history shows it.
export function archiveDeal(actor: Actor, id: number, opts?: { at?: string; run?: string }): Deal {
  const at = opts?.at ?? nowEastern();
  const current = reload(id);
  if (current.archivedAt) return current;
  const before = dealFields(current);
  writeDealRow(id, { archivedAt: at }, actor, at, opts?.run ?? null);
  const deal = reload(id);
  logDealChange({ before, deal, actor, at, run: opts?.run });
  return deal;
}

export function restoreDeal(actor: Actor, id: number, opts?: { at?: string; run?: string }): Deal {
  const at = opts?.at ?? nowEastern();
  const current = reload(id);
  if (!current.archivedAt) return current;
  const before = dealFields(current);
  writeDealRow(id, { archivedAt: null }, actor, at, opts?.run ?? null);
  const deal = reload(id);
  logDealChange({ before, deal, actor, at, run: opts?.run });
  return deal;
}

// Estimate links are not logged to deal_changes (they are a link set, not a field value); the
// linked set is read live. Josh links/unlinks from the panel.
export function linkEstimate(id: number, estimateId: string, opts?: { at?: string }): Deal {
  reload(id);
  const e = estimateId.trim();
  if (!e) throw new ActionError("bad_request", "estimate id is required");
  linkEstimateRow(id, e, opts?.at ?? nowEastern());
  return reload(id);
}

export function unlinkEstimate(id: number, estimateId: string): Deal {
  reload(id);
  unlinkEstimateRow(id, estimateId);
  return reload(id);
}

export function dealHistory(id: number): DealChange[] {
  return readDealChanges(id);
}

// Revert a Claude or Duet deal change (handoff §5.4: "A reverted deal change restores the earlier
// deal values"). Only a claude/duet change is revertable. If the deal changed again after the
// change being reverted, return the two versions and ask before overwriting unless force is set.
export type DealRevertResult =
  | { status: "reverted"; deal: Deal; change: DealChange }
  | { status: "changed_again"; before: Record<string, unknown>; after: Record<string, unknown>; current: Record<string, unknown> };

export function revertDeal(actor: Actor, changeId: number, opts?: { force?: boolean; at?: string }): DealRevertResult {
  const at = opts?.at ?? nowEastern();
  const change = findDealChange(changeId);
  if (!change) throw new ActionError("not_found", `deal change ${changeId} not found`);
  if (change.actor !== "claude" && change.actor !== "duet") {
    throw new ActionError("not_revertable", "only a Claude or Duet change can be reverted");
  }
  const current = reload(change.dealId);
  const after = change.after ?? {};
  const currentFields = dealFields(current) as Record<string, unknown>;
  const changedAgain = Object.keys(after).some((k) => JSON.stringify(currentFields[k]) !== JSON.stringify(after[k]));
  if (changedAgain && !opts?.force) {
    const curSubset: Record<string, unknown> = {};
    for (const k of Object.keys(after)) curSubset[k] = currentFields[k];
    return { status: "changed_again", before: change.before ?? {}, after, current: curSubset };
  }
  const before = dealFields(current);
  // Restore only the fields the change touched, to their prior values.
  const restore = (change.before ?? {}) as Partial<Deal>;
  writeDealRow(change.dealId, restore, actor, at, null);
  const deal = reload(change.dealId);
  const logged = logDealChange({ before, deal, actor, at, forceAction: "revert", undoes: change.id })!;
  return { status: "reverted", deal, change: logged };
}
