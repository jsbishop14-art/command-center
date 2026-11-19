import type Database from "better-sqlite3";
import { expectedObjects, type ObjectSpec } from "./migrations";

export type ReadBack = {
  ok: boolean;
  missing: ObjectSpec[];
  present: ObjectSpec[];
};

// Read back the database objects the migrations say they should produce and compare, object by
// object (handoff 7.4 step 5; process.md "read back by object"). The updater treats a mismatch as
// a failure and rolls back.
export function verifyObjects(db: Database.Database, expected: ObjectSpec[] = expectedObjects()): ReadBack {
  const rows = db
    .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index')")
    .all() as { name: string; type: string }[];
  const have = new Set(rows.map((r) => `${r.type}:${r.name}`));
  const missing: ObjectSpec[] = [];
  const present: ObjectSpec[] = [];
  for (const o of expected) {
    if (have.has(`${o.type}:${o.name}`)) present.push(o);
    else missing.push(o);
  }
  return { ok: missing.length === 0, missing, present };
}
