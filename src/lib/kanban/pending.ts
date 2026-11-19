import fs from "node:fs";
import path from "node:path";
import { parse, serialize, type FMValue } from "./frontmatter";
import { atomicWrite, writeNewCard } from "./store";
import { pendingDir, pendingFile, attachmentsDir } from "./paths";
import { PENDING_KEY_ORDER, type Board, type Actor } from "./types";
import { getSetting, setSetting, nextCardId, putSnapshot } from "./state";
import { appendEntry } from "./activity";
import { cardSnapshotFields, type Card } from "./card";
import { nextOrder } from "./reconciler";
import { writeContext } from "./generate";
import { nowEastern } from "./time";

// Pending notes (handoff §4.4). Notes land in pending/ and show in the Home Inbox; they become
// cards only when Josh confirms. The pending/ folder format and Confirm live in this build; the
// intake routes (email/text/Shortcut) arrive in CC4 (spec §5).

export type PendingNote = {
  id: string;
  via: "email" | "sms" | "shortcut";
  received: string;
  source_ref: string | null;
  suggested_project: string | null;
  boards: Board[];
  suggested_at: string | null;
  suggested_by: Actor | null;
  text: string;
};

function asScalar(v: FMValue): string | null {
  if (v === null) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}
function asList(v: FMValue): string[] {
  if (v === null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

const NOTE_SEQ_KEY = "note_seq";

export function nextNoteId(): string {
  const last = Number(getSetting(NOTE_SEQ_KEY) || "0");
  const next = last + 1;
  setSetting(NOTE_SEQ_KEY, String(next));
  return `N-${String(next).padStart(4, "0")}`;
}

export function parsePending(text: string, fileName?: string): PendingNote {
  const doc = parse(text);
  const d = doc.data;
  const id = asScalar(d.id) || "";
  if (!/^N-\d{4,}$/.test(id)) throw new Error(`pending id must be N- plus 4+ digits (got ${JSON.stringify(id)})`);
  if (fileName && fileName !== `${id}.md`) throw new Error(`id ${id} does not match file name ${fileName}`);
  const via = (asScalar(d.via) || "email") as PendingNote["via"];
  return {
    id,
    via,
    received: asScalar(d.received) || "",
    source_ref: asScalar(d.source_ref),
    suggested_project: asScalar(d.suggested_project),
    boards: (asList(d.boards).length ? asList(d.boards) : ["josh"]) as Board[],
    suggested_at: asScalar(d.suggested_at),
    suggested_by: (asScalar(d.suggested_by) as Actor | null) ?? null,
    text: doc.body,
  };
}

export function serializePending(n: PendingNote): string {
  const data: Record<string, FMValue> = {
    id: n.id,
    via: n.via,
    received: n.received,
    source_ref: n.source_ref,
    suggested_project: n.suggested_project,
    boards: n.boards,
    suggested_at: n.suggested_at,
    suggested_by: n.suggested_by,
  };
  return serialize({ data, order: [...PENDING_KEY_ORDER], body: n.text }, [...PENDING_KEY_ORDER]);
}

export function listPending(): PendingNote[] {
  if (!fs.existsSync(pendingDir())) return [];
  const out: PendingNote[] = [];
  for (const f of fs.readdirSync(pendingDir())) {
    if (!f.endsWith(".md") || f.startsWith(".")) continue;
    try {
      out.push(parsePending(fs.readFileSync(path.join(pendingDir(), f), "utf8"), f));
    } catch {
      // A malformed pending file is skipped here; it stays in the folder.
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function readPending(id: string): PendingNote | null {
  const file = pendingFile(id);
  if (!fs.existsSync(file)) return null;
  return parsePending(fs.readFileSync(file, "utf8"), `${id}.md`);
}

// Create a pending note (handoff §4.4). Used by the CC4 intake routes later; here for Confirm
// testing and to log note_received. Boards default to the suggested boards.
export function createPendingNote(input: {
  via: PendingNote["via"];
  text: string;
  source_ref?: string | null;
  boards?: Board[];
  suggested_project?: string | null;
  suggested_by?: Actor | null;
  suggested_at?: string | null;
  at?: string;
}): PendingNote {
  const at = input.at ?? nowEastern();
  const note: PendingNote = {
    id: nextNoteId(),
    via: input.via,
    received: at,
    source_ref: input.source_ref ?? null,
    suggested_project: input.suggested_project ?? null,
    boards: input.boards ?? ["josh"],
    suggested_at: input.suggested_at ?? null,
    suggested_by: input.suggested_by ?? null,
    text: input.text,
  };
  fs.mkdirSync(pendingDir(), { recursive: true });
  atomicWrite(pendingFile(note.id), serializePending(note));
  appendEntry({ at, actor: "unknown", card: note.id, action: "note_received" });
  return note;
}

// Set the suggested project and boards on a pending note (handoff §4.8 suggest note; Sync uses it).
export function suggestNote(
  noteId: string,
  input: { project?: string | null; boards?: Board[] },
  writer: Actor,
  at: string = nowEastern(),
  run?: string,
): PendingNote {
  const note = readPending(noteId);
  if (!note) throw new Error(`pending note ${noteId} not found`);
  if (input.project !== undefined) note.suggested_project = input.project;
  if (input.boards !== undefined) note.boards = input.boards;
  note.suggested_at = at;
  note.suggested_by = writer;
  atomicWrite(pendingFile(noteId), serializePending(note));
  appendEntry({ at, actor: writer, card: noteId, action: "note_suggested", run });
  return note;
}

// Confirm a pending note into a card (handoff §4.4): create a card in cards/ at stage inbox, move
// attachments to the card's folder, log confirm_note, then delete the pending file. Josh picks the
// project and boards before confirming (Change).
export function confirmNote(
  noteId: string,
  input: { project?: string | null; boards?: Board[] },
  actor: Actor = "josh",
  at: string = nowEastern(),
): Card {
  const note = readPending(noteId);
  if (!note) throw new Error(`pending note ${noteId} not found`);
  const id = nextCardId();
  const boards = input.boards ?? note.boards;
  const project = input.project !== undefined ? input.project : note.suggested_project;
  const card: Card = {
    id,
    title: note.text.split("\n")[0].slice(0, 120) || "Note",
    stage: "inbox",
    boards,
    area: "business",
    project: project ?? null,
    due: null,
    order: nextOrder("inbox"),
    created: at,
    updated: at,
    created_by: actor,
    source: note.via,
    source_ref: note.source_ref,
    waiting_on: null,
    waiting_since: null,
    done_at: null,
    discarded_at: null,
    last_actor: actor,
    last_run: null,
    notes: note.text,
    extra: {},
    extraOrder: [],
  };
  writeNewCard(card);
  // Move any attachments from the note's folder to the card's folder.
  const noteAtt = path.join(attachmentsDir(), noteId);
  const cardAtt = path.join(attachmentsDir(), id);
  if (fs.existsSync(noteAtt)) fs.renameSync(noteAtt, cardAtt);
  appendEntry({ at, actor, card: id, action: "confirm_note" });
  putSnapshot(id, cardSnapshotFields(card), card.updated, at);
  writeContext(card);
  fs.rmSync(pendingFile(noteId));
  return card;
}

// Dismiss a pending note (handoff §4.4): delete it without making a card, log note_dismissed.
export function dismissNote(noteId: string, actor: Actor = "josh", at: string = nowEastern()): void {
  const note = readPending(noteId);
  if (!note) throw new Error(`pending note ${noteId} not found`);
  fs.rmSync(pendingFile(noteId));
  appendEntry({ at, actor, card: noteId, action: "note_dismissed" });
}
