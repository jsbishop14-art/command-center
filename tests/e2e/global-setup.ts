import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { seed } from "../../src/lib/seed";
import { ensureLayout } from "../../src/lib/kanban/store";
import { reconcile } from "../../src/lib/kanban/reconciler";
import { addCard } from "../../src/lib/kanban/actions-layer";
import { issueToken } from "../../src/lib/kanban/tokens";
import { nowEastern } from "../../src/lib/kanban/time";

// Seed a fresh database AND kanban folder for the browser tests. The app (started by Playwright's
// webServer) reads the same CC_DB_PATH and CC_KANBAN_DIR. Passwords match tests/e2e/util.ts.
export default async function globalSetup() {
  const rel = process.env.CC_DB_PATH || ".e2e/cc.db";
  const dbPath = path.resolve(rel);
  process.env.CC_DB_PATH = dbPath;
  const kanbanDir = path.resolve(process.env.CC_KANBAN_DIR || ".e2e/kanban");
  process.env.CC_KANBAN_DIR = kanbanDir;
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
  rmSync(kanbanDir, { recursive: true, force: true });

  // getDb() reads CC_DB_PATH at call time, so seeding targets the file just set above.
  runMigrations(getDb());
  seed();

  // Seed the kanban folder: board.yaml + AGENTS.md via one reconcile pass, then a few cards for the
  // board and panel tests (one on Josh's board, one Claude-created, one on Christine's board).
  ensureLayout();
  reconcile();
  const at = nowEastern();
  addCard("josh", { title: "Ohio sites presentation", stage: "in_progress", boards: ["josh"], area: "business", project: "ohio" }, { at });
  addCard("claude", { title: "Card created from a Claude chat", stage: "next", boards: ["josh"], area: "business", source: "claude_chat" }, { at, run: "chat-seed" });
  addCard("josh", { title: "Family calendar sync", stage: "inbox", boards: ["christine", "bishops"], area: "family" }, { at });

  // Issue action-layer tokens for the route tests; write the plaintext to a file the tests read.
  const tokens = { claude: issueToken("claude", at), duet: issueToken("duet", at) };
  writeFileSync(path.resolve(".e2e/tokens.json"), JSON.stringify(tokens));

  // eslint-disable-next-line no-console
  console.log(`e2e: seeded ${dbPath} and ${kanbanDir}`);
}
