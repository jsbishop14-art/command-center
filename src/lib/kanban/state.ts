import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db";
import { kanbanDir, newDir, cardsDir } from "./paths";

// DB-backed kanban state (migration 0002): card id sequence, global settings, Problems list, and
// the snapshot cache used by the activity log differ. Cards themselves live in files, not the DB
// (handoff §4: there is no database table for cards).

// ---- Card ids (handoff §4.3: only the app assigns ids, in sequence) --------------------------

function highestExistingNumber(): number {
  let max = 0;
  for (const dir of [cardsDir()]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = /^CC-(\d{4,})\.md$/.exec(f);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  // Archived cards keep their ids; a reused id would collide. Scan archive too.
  const archiveRoot = path.join(kanbanDir(), "archive");
  if (fs.existsSync(archiveRoot)) {
    for (const year of fs.readdirSync(archiveRoot)) {
      const yd = path.join(archiveRoot, year);
      if (!fs.statSync(yd).isDirectory()) continue;
      for (const f of fs.readdirSync(yd)) {
        const m = /^CC-(\d{4,})\.md$/.exec(f);
        if (m) max = Math.max(max, Number(m[1]));
      }
    }
  }
  return max;
}

export function formatCardId(n: number): string {
  return `CC-${String(n).padStart(4, "0")}`;
}

// Assign the next id in sequence. Guards against a sequence that trails the files on disk (e.g.
// after a restore) by taking the max of the counter and the highest id present.
export function nextCardId(): string {
  const db = getDb();
  const row = db.prepare("SELECT last FROM card_seq WHERE id = 1").get() as { last: number } | undefined;
  const floor = Math.max(row?.last ?? 0, highestExistingNumber());
  const next = floor + 1;
  db.prepare("UPDATE card_seq SET last = ? WHERE id = 1").run(next);
  return formatCardId(next);
}

// ---- Settings (handoff §4.8: Duet on/off switch; more later) ----------------------------------

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export const DUET_ENABLED_KEY = "duet_enabled";

// Duet is off by default (spec §1; handoff §4.8: build Duet behind the switch).
export function duetEnabled(): boolean {
  return getSetting(DUET_ENABLED_KEY) === "1";
}
export function setDuetEnabled(on: boolean): void {
  setSetting(DUET_ENABLED_KEY, on ? "1" : "0");
}

// ---- Problems (handoff §4.9: a file that fails validation is listed, not dropped) -------------

export type Problem = { file: string; reason: string; at: string };

export function recordProblem(file: string, reason: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO kanban_problems (file, reason, at) VALUES (?, ?, ?)
       ON CONFLICT(file) DO UPDATE SET reason = excluded.reason, at = excluded.at`,
    )
    .run(file, reason, at);
}

export function clearProblem(file: string): void {
  getDb().prepare("DELETE FROM kanban_problems WHERE file = ?").run(file);
}

export function listProblems(): Problem[] {
  return getDb().prepare("SELECT file, reason, at FROM kanban_problems ORDER BY file").all() as Problem[];
}

// ---- Snapshots (handoff §4.6: last-seen version of each card, for computing before/after) ------

export type Snapshot = { card_id: string; fields: Record<string, unknown>; updated: string };

export function getSnapshot(cardId: string): Snapshot | null {
  const row = getDb()
    .prepare("SELECT card_id, fields, updated FROM kanban_snapshots WHERE card_id = ?")
    .get(cardId) as { card_id: string; fields: string; updated: string } | undefined;
  if (!row) return null;
  return { card_id: row.card_id, fields: JSON.parse(row.fields), updated: row.updated };
}

export function putSnapshot(cardId: string, fields: Record<string, unknown>, updated: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO kanban_snapshots (card_id, fields, updated, seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET fields = excluded.fields, updated = excluded.updated, seen_at = excluded.seen_at`,
    )
    .run(cardId, JSON.stringify(fields), updated, at);
}

export function deleteSnapshot(cardId: string): void {
  getDb().prepare("DELETE FROM kanban_snapshots WHERE card_id = ?").run(cardId);
}

export function allSnapshotIds(): string[] {
  return (getDb().prepare("SELECT card_id FROM kanban_snapshots").all() as { card_id: string }[]).map(
    (r) => r.card_id,
  );
}

// Exposed for the reconciler's "files in new/" scan.
export function listNewFiles(): string[] {
  if (!fs.existsSync(newDir())) return [];
  return fs.readdirSync(newDir()).filter((f) => f.endsWith(".md") && !f.startsWith("."));
}
