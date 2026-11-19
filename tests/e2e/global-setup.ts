import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { seed } from "../../src/lib/seed";

// Seed a fresh database for the browser tests. The app (started by Playwright's webServer) reads
// the same CC_DB_PATH. Passwords match the e2e defaults used by tests/e2e/util.ts.
export default async function globalSetup() {
  const rel = process.env.CC_DB_PATH || ".e2e/cc.db";
  const dbPath = path.resolve(rel);
  process.env.CC_DB_PATH = dbPath;
  process.env.CC_JOSH_PASSWORD = process.env.CC_JOSH_PASSWORD || "josh-dev-password";
  process.env.CC_CHRISTINE_PASSWORD = process.env.CC_CHRISTINE_PASSWORD || "christine-dev-password";

  mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(dbPath + suffix);
    } catch {
      // not there
    }
  }

  // getDb() reads CC_DB_PATH at call time, so seeding targets the file just set above.
  runMigrations(getDb());
  seed();
  // eslint-disable-next-line no-console
  console.log(`e2e: seeded ${dbPath}`);
}
