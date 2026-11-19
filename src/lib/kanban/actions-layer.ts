import { readCardFile, writeNewCard, mutateCard } from "./store";
import { cardSnapshotFields, applyFields, type Card } from "./card";
import { logCardChange, findEntry, type LogEntry } from "./activity";
import { nextCardId, putSnapshot, getSnapshot } from "./state";
import { nextOrder, sourceRefExists } from "./reconciler";
import { writeContext } from "./generate";
import { nowEastern } from "./time";
import {
  STAGES,
  AREAS,
  BOARDS,
  type Actor,
  type Area,
  type Board,
  type Source,
  type Stage,
} from "./types";

// The action layer (handoff §4.8): the card commands the app carries out, writing the same files
// and log lines as the UI. Josh and Christine reach these through the UI; Claude and Duet reach
// them through the tokened route. Claude/Duet are held to the limits in handoff §4.7 rule 8.

export type ActionErrorCode = "not_found" | "limit" | "duplicate" | "bad_request" | "not_revertable";

export class ActionError extends Error {
  code: ActionErrorCode;
  constructor(code: ActionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ActionError";
  }
}

function isTokenWriter(actor: Actor): boolean {
  return actor === "claude" || actor === "duet";
}

// Enforce the Claude/Duet limits (handoff §4.7 rule 8). The tokened path never overrides them; the
// "when Josh asks in a chat" exception is Claude on the Mac mini editing files directly, not the
// token (spec §4 check 2).
function enforceLimits(actor: Actor, change: { stage?: Stage; boards?: unknown; bodyRewrite?: boolean }): void {
  if (!isTokenWriter(actor)) return;
  if (change.stage === "done" || change.stage === "discarded") {
    throw new ActionError("limit", `${actor} cannot move a card to ${change.stage}`);
  }
  if (change.boards !== undefined) {
    throw new ActionError("limit", `${actor} cannot change a card's boards`);
  }
  if (change.bodyRewrite) {
    throw new ActionError("limit", `${actor} cannot rewrite a card body (notes are append only)`);
  }
}

function validEnum<T extends string>(value: string, set: readonly T[], field: string): T {
  if (!(set as readonly string[]).includes(value)) throw new ActionError("bad_request", `invalid ${field}: ${value}`);
  return value as T;
}

export type AddCardInput = {
  title: string;
  stage?: string;
  boards?: string[];
  area?: string;
  project?: string | null;
  due?: string | null;
  source?: string;
  source_ref?: string | null;
  notes?: string;
};

export function addCard(actor: Actor, input: AddCardInput, opts?: { at?: string; run?: string }): Card {
  const at = opts?.at ?? nowEastern();
  if (!input.title || !input.title.trim()) throw new ActionError("bad_request", "title is required");
  const stage = validEnum(input.stage ?? "inbox", STAGES, "stage");
  // Claude/Duet may not create a card straight into done or discarded (handoff §4.7 rule 8).
  enforceLimits(actor, { stage });
  const boards = (input.boards && input.boards.length ? input.boards : ["josh"]).map((b) =>
    validEnum(b, BOARDS, "board"),
  ) as Board[];
  const area = validEnum(input.area ?? "business", AREAS, "area") as Area;
  const ref = input.source_ref ?? null;
  if (ref && sourceRefExists(ref)) throw new ActionError("duplicate", `a card with source_ref ${ref} already exists`);

  const id = nextCardId();
  const card: Card = {
    id,
    title: input.title.trim(),
    stage,
    boards,
    area,
    project: input.project ?? null,
    due: input.due ?? null,
    order: nextOrder(stage),
    created: at,
    updated: at,
    created_by: actor,
    source: validEnum(input.source ?? (isTokenWriter(actor) ? "claude_chat" : "manual"), [
      "manual", "email", "sms", "shortcut", "claude_chat", "sync", "ezbinder",
    ] as const, "source") as Source,
    source_ref: ref,
    waiting_on: stage === "waiting_on" ? "someone" : null,
    waiting_since: stage === "waiting_on" ? at : null,
    done_at: null,
    discarded_at: null,
    last_actor: actor,
    last_run: opts?.run ?? null,
    notes: input.notes ?? "",
    extra: {},
    extraOrder: [],
  };
  writeNewCard(card);
  logCardChange({ beforeFields: null, card, actor, run: opts?.run, at });
  putSnapshot(id, cardSnapshotFields(card), card.updated, at);
  writeContext(card);
  return card;
}

// Internal: apply a transform to a card and record it as the app (log + snapshot + context), with
// re-read-before-write (handoff §4.7 rule 2). Returns the written card.
function writeChange(
  id: string,
  actor: Actor,
  at: string,
  run: string | undefined,
  transform: (cur: Card) => Card,
): Card {
  const current = readCardFile(id);
  if (!current) throw new ActionError("not_found", `card ${id} not found`);
  const beforeFields = getSnapshot(id)?.fields ?? cardSnapshotFields(current);
  const written = mutateCard(id, (cur) => {
    const next = transform(cur);
    return { ...next, updated: at, last_actor: actor, last_run: run ?? null };
  });
  if (!written) return current;
  logCardChange({ beforeFields, card: written, actor, run, at });
  putSnapshot(id, cardSnapshotFields(written), written.updated, at);
  writeContext(written);
  return written;
}

export type UpdateCardInput = {
  title?: string;
  area?: string;
  project?: string | null;
  due?: string | null;
  stage?: string;
  boards?: string[];
  order?: number;
  waiting_on?: string | null;
  waiting_since?: string | null;
  notes?: string; // a full-body rewrite — forbidden for Claude/Duet
};

export function updateCard(actor: Actor, id: string, input: UpdateCardInput, opts?: { at?: string; run?: string }): Card {
  const at = opts?.at ?? nowEastern();
  const stage = input.stage ? validEnum(input.stage, STAGES, "stage") : undefined;
  enforceLimits(actor, {
    stage,
    boards: input.boards,
    bodyRewrite: input.notes !== undefined,
  });
  return writeChange(id, actor, at, opts?.run, (cur) => {
    const next: Card = { ...cur, boards: [...cur.boards], extra: { ...cur.extra } };
    if (input.title !== undefined) next.title = input.title;
    if (input.area !== undefined) next.area = validEnum(input.area, AREAS, "area") as Area;
    if (input.project !== undefined) next.project = input.project;
    if (input.due !== undefined) next.due = input.due;
    if (input.order !== undefined) next.order = input.order;
    if (input.boards !== undefined) next.boards = input.boards.map((b) => validEnum(b, BOARDS, "board")) as Board[];
    if (input.notes !== undefined) next.notes = input.notes;
    if (stage !== undefined) applyStage(next, stage, at, input);
    if (input.waiting_on !== undefined) next.waiting_on = input.waiting_on;
    if (input.waiting_since !== undefined) next.waiting_since = input.waiting_since;
    return next;
  });
}

// Set a card's stage, keeping the stage-dependent fields consistent (handoff §4.2).
function applyStage(card: Card, stage: Stage, at: string, input?: UpdateCardInput): void {
  card.stage = stage;
  if (stage === "done") {
    card.done_at = at;
    card.discarded_at = null;
  } else if (stage === "discarded") {
    card.discarded_at = at;
    card.done_at = null;
  } else {
    card.done_at = null;
    card.discarded_at = null;
  }
  if (stage === "waiting_on") {
    card.waiting_on = input?.waiting_on ?? card.waiting_on ?? "someone";
    card.waiting_since = input?.waiting_since ?? card.waiting_since ?? at;
  } else {
    card.waiting_on = null;
    card.waiting_since = null;
  }
}

export function moveCard(actor: Actor, id: string, stage: string, order?: number, opts?: { at?: string; run?: string }): Card {
  const at = opts?.at ?? nowEastern();
  const s = validEnum(stage, STAGES, "stage");
  enforceLimits(actor, { stage: s });
  return writeChange(id, actor, at, opts?.run, (cur) => {
    const next: Card = { ...cur, boards: [...cur.boards], extra: { ...cur.extra } };
    applyStage(next, s, at);
    if (order !== undefined) next.order = order;
    return next;
  });
}

// Append a line to a card's notes (handoff §4.8 append note). Allowed for every writer: bodies are
// append only for Claude/Duet, and append is the allowed operation.
export function appendNote(actor: Actor, id: string, text: string, opts?: { at?: string; run?: string }): Card {
  const at = opts?.at ?? nowEastern();
  if (!text) throw new ActionError("bad_request", "note text is required");
  return writeChange(id, actor, at, opts?.run, (cur) => {
    const sep = cur.notes.trim().length ? "\n\n" : "";
    return { ...cur, boards: [...cur.boards], extra: { ...cur.extra }, notes: cur.notes + sep + text };
  });
}

export function readCard(id: string): Card {
  const c = readCardFile(id);
  if (!c) throw new ActionError("not_found", `card ${id} not found`);
  return c;
}

// Revert a Claude or Duet change (handoff §5.4). Restores the before values from the log line and
// logs it as revert, naming the id it undoes. If the card changed again after that change, it
// returns the two versions and asks before overwriting unless force is set.
export type RevertResult =
  | { status: "reverted"; card: Card; entry: LogEntry }
  | { status: "changed_again"; before: Record<string, unknown>; after: Record<string, unknown>; current: Record<string, unknown> };

export function revertChange(actor: Actor, logId: string, opts?: { force?: boolean; at?: string }): RevertResult {
  const at = opts?.at ?? nowEastern();
  const entry = findEntry(logId);
  if (!entry) throw new ActionError("not_found", `log entry ${logId} not found`);
  if (entry.actor !== "claude" && entry.actor !== "duet") {
    throw new ActionError("not_revertable", "only a Claude or Duet change can be reverted");
  }
  const card = readCardFile(entry.card);
  if (!card) throw new ActionError("not_found", `card ${entry.card} not found`);
  const after = entry.after ?? {};
  const currentFields = cardSnapshotFields(card);
  const changedAgain = Object.keys(after).some(
    (k) => JSON.stringify(currentFields[k]) !== JSON.stringify((after as Record<string, unknown>)[k]),
  );
  if (changedAgain && !opts?.force) {
    const current: Record<string, unknown> = {};
    for (const k of Object.keys(after)) current[k] = currentFields[k];
    return { status: "changed_again", before: entry.before ?? {}, after, current };
  }
  const beforeFields = cardSnapshotFields(card);
  const written = mutateCard(entry.card, (cur) => {
    const reverted = applyFields(cur, entry.before ?? {});
    return { ...reverted, updated: at, last_actor: actor, last_run: null };
  })!;
  const logged = logCardChange({ beforeFields, card: written, actor, at, forceAction: "revert", undoes: logId })!;
  putSnapshot(entry.card, cardSnapshotFields(written), written.updated, at);
  writeContext(written);
  return { status: "reverted", card: written, entry: logged };
}
