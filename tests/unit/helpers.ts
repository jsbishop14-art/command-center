import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the app at a fresh, isolated SQLite file for a test (handoff 7.5: each job gets its own
// seeded local database). Call before importing modules that open the database — getDb() reads the
// path at call time and reopens when it changes, so setting the env in beforeEach is enough.
export function useTempDb(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cc-test-"));
  const dbFile = path.join(dir, "cc.db");
  process.env.CC_DB_PATH = dbFile;
  return dbFile;
}

export const TEST_SECRET_KEY = "11111111111111111111111111111111111111111111111111111111111111ab";
