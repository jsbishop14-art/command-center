import "server-only";
import fs from "node:fs";
import { logDir, logFileFor } from "./paths";
import { cardSnapshotFields, type Card } from "./card";
import type { Actor } from "./types";

// Activity log (handoff §4.6). Every change to a card gets one JSON line in log/<YYYY-MM>.jsonl,
// holding the values before and after so any change can be reverted (§5.4). Only the app writes log
// lines (CLAUDE §6; Josh 2026-11-09 14:47 "you decide"). Each line is one append and stays small.

export type Action =
  | "create"
  | "edit"
  | "move"
  | "board_add"
  | "board_remove"
  | "discard"
  | "archive"
  | "restore"
  | "revert"
  // Note actions (handoff §4.6).
  | "note_received"
  | "note_suggested"
  | "note_dismissed"
  | "confirm_note";

export type LogEntry = {
  id: string; // L-YYYY-MM-NNNNNN
  at: string;
  actor: Actor;
  card: string;
  action: Action;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  run?: string;
  undoes?: string; // for a revert line, the log id it undoes (§4.6)
};

// Fields whose change is meaningful for the log's before/after (handoff §4.6 example shows only the
// changed fields). `updated`, `last_actor`, `last_run` are attribution metadata, not logged content.
const MEANINGFUL = [
  "title",
  "stage",
  "boards",
  "area",
  "project",
  "due",
  "order",
  "waiting_on",
  "waiting_since",
  "done_at",
  "discarded_at",
  "notes",
] as const;

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type Diff = {
  changed: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

// Compute the field-level diff between a before snapshot (or null for a new card) and a card now.
export function diff(beforeFields: Record<string, unknown> | null, card: Card): Diff {
  const nowFields = cardSnapshotFields(card);
  const changed: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const f of MEANINGFUL) {
    const b = beforeFields ? beforeFields[f] : undefined;
    const a = nowFields[f];
    if (!beforeFields || !eq(b, a)) {
      changed.push(f);
      if (beforeFields) before[f] = b;
      after[f] = a;
    }
  }
  return { changed, before, after };
}

// Pick the action label from a diff (handoff §4.6 action list). before/after still carry every
// changed meaningful field, so Revert works regardless of the label.
export function classify(beforeFields: Record<string, unknown> | null, card: Card, d: Diff): Action {
  if (!beforeFields) return "create";
  if (d.changed.includes("stage")) {
    if (card.stage === "discarded") return "discard";
    const wasDiscarded = beforeFields.stage === "discarded";
    if (wasDiscarded) return "restore";
    return "move";
  }
  if (d.changed.includes("boards")) {
    const b = (beforeFields.boards as string[]) ?? [];
    const a = card.boards;
    if (a.length > b.length) return "board_add";
    if (a.length < b.length) return "board_remove";
    return "edit";
  }
  return "edit";
}

function monthOf(at: string): string {
  return at.slice(0, 7); // YYYY-MM
}

// Next sequential log id within a month file (handoff §4.6 example L-2026-11-000123).
function nextLogId(at: string): string {
  const ym = monthOf(at);
  const file = logFileFor(ym);
  let max = 0;
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const m = /"id":"L-\d{4}-\d{2}-(\d{6})"/.exec(line);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `L-${ym}-${String(max + 1).padStart(6, "0")}`;
}

// Append one line to the month log file. Created with a single append write (handoff §4.6).
export function appendEntry(entry: Omit<LogEntry, "id">): LogEntry {
  fs.mkdirSync(logDir(), { recursive: true });
  const id = nextLogId(entry.at);
  const full: LogEntry = { id, ...entry };
  const line = JSON.stringify(full);
  fs.appendFileSync(logFileFor(monthOf(entry.at)), line + "\n");
  return full;
}

// Convenience: log a card change computed from a before snapshot. Returns the entry, or null when
// nothing meaningful changed (e.g. only `updated` moved).
export function logCardChange(args: {
  beforeFields: Record<string, unknown> | null;
  card: Card;
  actor: Actor;
  run?: string | null;
  at: string;
  forceAction?: Action;
  undoes?: string;
}): LogEntry | null {
  const d = diff(args.beforeFields, args.card);
  if (args.beforeFields && d.changed.length === 0) return null;
  const action = args.forceAction ?? classify(args.beforeFields, args.card, d);
  const entry: Omit<LogEntry, "id"> = {
    at: args.at,
    actor: args.actor,
    card: args.card.id,
    action,
    run: args.run || undefined,
  };
  if (args.beforeFields) entry.before = d.before;
  entry.after = d.after;
  if (args.undoes) entry.undoes = args.undoes;
  return appendEntry(entry);
}

// Read all log entries, oldest first, optionally for one card. Reads every month file present.
export function readEntries(cardId?: string): LogEntry[] {
  if (!fs.existsSync(logDir())) return [];
  const files = fs
    .readdirSync(logDir())
    .filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f))
    .sort();
  const out: LogEntry[] = [];
  for (const f of files) {
    const text = fs.readFileSync(`${logDir()}/${f}`, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as LogEntry;
        if (!cardId || e.card === cardId) out.push(e);
      } catch {
        // A corrupt line is skipped; the file remains for inspection.
      }
    }
  }
  return out;
}

export function findEntry(logId: string): LogEntry | null {
  return readEntries().find((e) => e.id === logId) ?? null;
}
