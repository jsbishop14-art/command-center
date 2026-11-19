#!/usr/bin/env tsx
// Apply migrations to the local database and read back the objects each migration expects
// (handoff 7.4 step 5). Exits non-zero on a read-back mismatch so the updater can roll back.
import { getDb, dbPath } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrations";
import { verifyObjects } from "../src/lib/schema-check";

function main() {
  const db = getDb();
  const applied = runMigrations(db);
  console.log(`migrate: database ${dbPath()}`);
  console.log(`migrate: applied ${applied.length ? applied.join(", ") : "nothing (up to date)"}`);

  const check = verifyObjects(db);
  console.log(`migrate: read-back ${check.present.length}/${check.present.length + check.missing.length} objects present`);
  if (!check.ok) {
    console.error(`migrate: MISSING ${check.missing.map((o) => `${o.type}:${o.name}`).join(", ")}`);
    process.exit(1);
  }
  console.log("migrate: read-back OK");
}

main();
