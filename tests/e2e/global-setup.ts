import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { seed } from "../../src/lib/seed";
import { ensureLayout } from "../../src/lib/kanban/store";
import { reconcile } from "../../src/lib/kanban/reconciler";
import { addCard } from "../../src/lib/kanban/actions-layer";
import { issueToken } from "../../src/lib/kanban/tokens";
import { nowEastern, todayEastern } from "../../src/lib/kanban/time";
import { connectFeed } from "../../src/lib/feeds/store";
import { connectGmail, setIntakeAddress } from "../../src/lib/feeds/gmail";
import { runRefresh } from "../../src/lib/feeds/refresh";
import { issueShortcutToken } from "../../src/lib/shortcut";

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
  // Must match the webServer's CC_SECRET_KEY (playwright.config.ts) so calendar tokens sealed here
  // can be opened by the running app on Refresh.
  process.env.CC_SECRET_KEY =
    process.env.CC_SECRET_KEY || "0000000000000000000000000000000000000000000000000000000000000000";

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
  // CC3 Home panels: a card due today on Josh's board (Today panel), and an in-progress card on
  // Christine's board so the board toggle visibly swaps the Kanban panel (spec checks 2 and 5).
  const today = todayEastern();
  addCard("josh", { title: "Call ES rep about pool order", stage: "next", boards: ["josh"], area: "business", due: today }, { at });
  addCard("christine", { title: "Plan weekend groceries", stage: "in_progress", boards: ["christine"], area: "family" }, { at });

  // CC3 feeds: connect the three calendars so the Today panel populates. Stub feeds — no real call.
  for (const slug of ["josh_work", "josh_personal", "christine"]) connectFeed(slug, at, "josh");

  // CC4 feeds: connect Gmail and set the intake address so the Inbox and Awaiting reply panels
  // populate on first load. The one Refresh below polls the intake mailbox (stub) into pending
  // notes and loads the Awaiting-reply threads (stub). No real outside call, no real email.
  connectGmail(at);
  setIntakeAddress("josh+notes@worthprop.com");
  await runRefresh();

  // Issue action-layer tokens for the route tests; write the plaintext to a file the tests read.
  // CC_DB_PATH/CC_KANBAN_DIR may live under RUNNER_TEMP in CI, so the repo-root .e2e/ folder is not
  // created by the steps above — make it here before writing.
  const artifactsDir = path.resolve(".e2e");
  mkdirSync(artifactsDir, { recursive: true });
  const tokens = {
    claude: issueToken("claude", at),
    duet: issueToken("duet", at),
    shortcut: issueShortcutToken(at),
  };
  writeFileSync(path.join(artifactsDir, "tokens.json"), JSON.stringify(tokens));

  // eslint-disable-next-line no-console
  console.log(`e2e: seeded ${dbPath} and ${kanbanDir}`);
}
