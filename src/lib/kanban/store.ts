import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  kanbanDir,
  newDir,
  cardsDir,
  pendingDir,
  attachmentsDir,
  contextDir,
  logDir,
  cardFile,
} from "./paths";
import { parseCard, serializeCard } from "./card";
import type { Card } from "./types";

// Low-level file store for kanban cards (handoff §4.7). Writes are atomic (temp file + rename) and
// re-read-before-write so two writers changing the same card both keep their changes (rule 2).

export function ensureLayout(): void {
  for (const dir of [kanbanDir(), newDir(), cardsDir(), pendingDir(), attachmentsDir(), contextDir(), logDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Write text to a path atomically: a temp file in the same folder, fsync, then rename over the
// target (handoff §4.7 rule 1). Rename is atomic within a folder on macOS and Linux.
export function atomicWrite(target: string, text: string): void {
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(target)}.tmp-${process.pid}-${writeCounter++}`);
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, target);
}
let writeCounter = 0;

export function readCardFile(id: string): Card | null {
  const file = cardFile(id);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  return parseCard(text, `${id}.md`);
}

export function cardExists(id: string): boolean {
  return fs.existsSync(cardFile(id));
}

export function listCardIds(): string[] {
  if (!fs.existsSync(cardsDir())) return [];
  return fs
    .readdirSync(cardsDir())
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((f) => f.slice(0, -3))
    .sort();
}

export function listCards(): Card[] {
  const out: Card[] = [];
  for (const id of listCardIds()) {
    try {
      const c = readCardFile(id);
      if (c) out.push(c);
    } catch {
      // Invalid files are surfaced by the reconciler's Problems view, not here.
    }
  }
  return out;
}

// Mutator type: receives the current card, returns the changed card (or null to make no change).
export type CardMutator = (current: Card) => Card | null;

// Apply a change atomically with re-read-before-write (handoff §4.7 rule 2). Reads the current
// file, lets the mutator compute the new card, re-reads once more to confirm `updated` has not
// moved since the read, and if it has, re-applies the mutator to the current version. Returns the
// written card, or null if the mutator made no change.
export function mutateCard(id: string, mutate: CardMutator): Card | null {
  const before = readCardFile(id);
  if (!before) throw new Error(`card ${id} not found`);
  let next = mutate(before);
  if (!next) return null;
  // Re-read; if the on-disk version changed since we read it, re-apply onto the current version.
  const recheck = readCardFile(id);
  if (recheck && recheck.updated !== before.updated) {
    next = mutate(recheck);
    if (!next) return null;
  }
  atomicWrite(cardFile(id), serializeCard(next));
  return next;
}

export function writeNewCard(card: Card): void {
  atomicWrite(cardFile(card.id), serializeCard(card));
}
