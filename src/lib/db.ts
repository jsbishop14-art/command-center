import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// The local database on the Mac mini. One SQLite file, no server process (handoff 1.2, 7.5).
// Single household: no tenant id, no row security. Path is overridable so CI and tests each get
// their own seeded database.
type DB = Database.Database;

export function dbPath(): string {
  return process.env.CC_DB_PATH || path.join(process.cwd(), "data", "cc.db");
}

// Open an independent connection at an explicit path (used by the updater read-back and tests).
export function openDatabaseAt(target: string): DB {
  const dir = path.dirname(target);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Reuse one connection per process (and survive Next.js dev hot-reload via globalThis).
const globalForDb = globalThis as unknown as { __ccDb?: DB; __ccDbPath?: string };

export function getDb(): DB {
  const target = dbPath();
  if (globalForDb.__ccDb && globalForDb.__ccDbPath === target) {
    return globalForDb.__ccDb;
  }
  if (globalForDb.__ccDb) {
    try {
      globalForDb.__ccDb.close();
    } catch {
      // already closed
    }
  }
  globalForDb.__ccDb = openDatabaseAt(target);
  globalForDb.__ccDbPath = target;
  return globalForDb.__ccDb;
}
