import { parse, serialize, type FMValue } from "./frontmatter";
import {
  AREAS,
  BOARDS,
  CARD_KEY_ORDER,
  SOURCES,
  STAGES,
  type Area,
  type Board,
  type Card,
  type Source,
  type Stage,
  type Actor,
  ACTORS,
} from "./types";

// Parse and validate a card file's text into a Card, or throw with a plain reason that the
// Problems view shows (handoff §4.9). Validation follows the field table in handoff §4.2.

export type { Card } from "./types";

const KNOWN = new Set<string>(CARD_KEY_ORDER);

function str(v: FMValue): string | null {
  if (v === null) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

function reqStr(data: Record<string, FMValue>, key: string): string {
  const v = str(data[key]);
  if (v === null || v === "") throw new Error(`${key} is required`);
  return v;
}

function asList(v: FMValue): string[] {
  if (v === null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

export function parseCard(text: string, fileName?: string): Card {
  const doc = parse(text);
  if (!doc.hadFrontmatter) throw new Error("file has no frontmatter block");
  const d = doc.data;

  const id = reqStr(d, "id");
  if (!/^CC-\d{4,}$/.test(id)) throw new Error(`id must be CC- plus 4+ digits (got ${JSON.stringify(id)})`);
  if (fileName && fileName !== `${id}.md`) {
    throw new Error(`id ${id} does not match file name ${fileName}`);
  }

  const title = reqStr(d, "title");

  const stage = reqStr(d, "stage") as Stage;
  if (!(STAGES as readonly string[]).includes(stage)) throw new Error(`stage ${JSON.stringify(stage)} is not a valid stage`);

  const boards = asList(d.boards) as Board[];
  if (boards.length === 0) throw new Error("boards must list one or more of josh, christine, bishops");
  for (const b of boards) {
    if (!(BOARDS as readonly string[]).includes(b)) throw new Error(`board ${JSON.stringify(b)} is not valid`);
  }

  const area = reqStr(d, "area") as Area;
  if (!(AREAS as readonly string[]).includes(area)) throw new Error(`area ${JSON.stringify(area)} is not valid`);

  const orderRaw = reqStr(d, "order");
  const order = Number(orderRaw);
  if (!Number.isFinite(order)) throw new Error(`order must be a number (got ${JSON.stringify(orderRaw)})`);

  const created = reqStr(d, "created");
  const updated = reqStr(d, "updated");

  const created_by = reqStr(d, "created_by") as Actor;
  if (!(ACTORS as readonly string[]).includes(created_by)) throw new Error(`created_by ${JSON.stringify(created_by)} is not valid`);

  const source = reqStr(d, "source") as Source;
  if (!(SOURCES as readonly string[]).includes(source)) throw new Error(`source ${JSON.stringify(source)} is not valid`);

  const last_actor = reqStr(d, "last_actor") as Actor;
  if (!(ACTORS as readonly string[]).includes(last_actor)) throw new Error(`last_actor ${JSON.stringify(last_actor)} is not valid`);

  if (stage === "waiting_on") {
    if (!str(d.waiting_on)) throw new Error("waiting_on is required when stage is waiting_on");
    if (!str(d.waiting_since)) throw new Error("waiting_since is required when stage is waiting_on");
  }
  if (stage === "done" && !str(d.done_at)) throw new Error("done_at is required when stage is done");
  if (stage === "discarded" && !str(d.discarded_at)) throw new Error("discarded_at is required when stage is discarded");

  const extra: Record<string, FMValue> = {};
  const extraOrder: string[] = [];
  for (const k of doc.order) {
    if (!KNOWN.has(k)) {
      extra[k] = d[k];
      extraOrder.push(k);
    }
  }

  return {
    id,
    title,
    stage,
    boards,
    area,
    project: str(d.project),
    due: str(d.due),
    order,
    created,
    updated,
    created_by,
    source,
    source_ref: str(d.source_ref),
    waiting_on: str(d.waiting_on),
    waiting_since: str(d.waiting_since),
    done_at: str(d.done_at),
    discarded_at: str(d.discarded_at),
    last_actor,
    last_run: str(d.last_run),
    notes: doc.body,
    extra,
    extraOrder,
  };
}

// Serialize a Card back to file text, emitting the documented key order then any unknown fields.
export function serializeCard(card: Card): string {
  const data: Record<string, FMValue> = {
    id: card.id,
    title: card.title,
    stage: card.stage,
    boards: card.boards,
    area: card.area,
    project: card.project,
    due: card.due,
    order: String(card.order),
    created: card.created,
    updated: card.updated,
    created_by: card.created_by,
    source: card.source,
    source_ref: card.source_ref,
    waiting_on: card.waiting_on,
    waiting_since: card.waiting_since,
    done_at: card.done_at,
    discarded_at: card.discarded_at,
    last_actor: card.last_actor,
    last_run: card.last_run,
  };
  const order: string[] = [...CARD_KEY_ORDER];
  for (const k of card.extraOrder) {
    data[k] = card.extra[k];
    order.push(k);
  }
  return serialize({ data, order, body: card.notes }, order);
}

// Apply a set of meaningful field values (from a log entry's before/after) onto a card, returning
// a new card. Used by Revert (handoff §5.4) to restore the "before" values. Unknown keys ignored.
export function applyFields(card: Card, fields: Record<string, unknown>): Card {
  const next: Card = { ...card, boards: [...card.boards], extra: { ...card.extra } };
  for (const [k, v] of Object.entries(fields)) {
    switch (k) {
      case "title":
        next.title = String(v);
        break;
      case "stage":
        next.stage = v as Card["stage"];
        break;
      case "boards":
        next.boards = (v as string[]).slice() as Card["boards"];
        break;
      case "area":
        next.area = v as Card["area"];
        break;
      case "project":
        next.project = (v as string | null) ?? null;
        break;
      case "due":
        next.due = (v as string | null) ?? null;
        break;
      case "order":
        next.order = Number(v);
        break;
      case "waiting_on":
        next.waiting_on = (v as string | null) ?? null;
        break;
      case "waiting_since":
        next.waiting_since = (v as string | null) ?? null;
        break;
      case "done_at":
        next.done_at = (v as string | null) ?? null;
        break;
      case "discarded_at":
        next.discarded_at = (v as string | null) ?? null;
        break;
      case "notes":
        next.notes = String(v ?? "");
        break;
    }
  }
  return next;
}

// The frontmatter fields the activity log compares and stores for before/after (handoff §4.6).
// The body (notes) is compared separately as a boolean "notes changed" for diffing.
export function cardSnapshotFields(card: Card): Record<string, unknown> {
  return {
    title: card.title,
    stage: card.stage,
    boards: [...card.boards],
    area: card.area,
    project: card.project,
    due: card.due,
    order: card.order,
    source_ref: card.source_ref,
    waiting_on: card.waiting_on,
    waiting_since: card.waiting_since,
    done_at: card.done_at,
    discarded_at: card.discarded_at,
    last_actor: card.last_actor,
    last_run: card.last_run,
    updated: card.updated,
    notes: card.notes,
  };
}
