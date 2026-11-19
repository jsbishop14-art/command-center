import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { connectFeed } from "../../src/lib/feeds/store";
import { runRefresh } from "../../src/lib/feeds/refresh";

// Spec check 4 / handoff §5 acceptance: "Refresh makes no Claude call." Refresh is ordinary code.
// Two guards: a static scan that the refresh and feeds code references no AI client, and a run that
// completes without any such client existing. A control proves the scanner would catch a hit.

const FEEDS_DIR = path.resolve(__dirname, "../../src/lib/feeds");
const AI_RE = /claude|anthropic/i;

// Scan code only, not comments: comments legitimately mention the CLAUDE.md rules and say the
// feed "calls no Claude client". What must be absent is an AI client in the code itself — an
// import of, or a call to, Claude/Anthropic.
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function scanForAi(text: string): boolean {
  return AI_RE.test(stripComments(text));
}

describe("refresh makes no Claude call (spec check 4)", () => {
  beforeEach(() => {
    process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
    useTempDb();
    runMigrations(getDb());
  });

  it("the scanner catches an AI reference in code but ignores comments (control)", () => {
    expect(scanForAi("const x = callClaude()")).toBe(true);
    expect(scanForAi("import { anthropic } from 'sdk'")).toBe(true);
    expect(scanForAi("const n = events.length")).toBe(false);
    expect(scanForAi("// calls no Claude client, see CLAUDE.md")).toBe(false);
  });

  it("no file on the refresh path references an AI client", () => {
    // The files runRefresh actually touches (audit by what is called, not by name). status.ts is
    // excluded on purpose: it only labels the "Claude" live-feed row, it is not on this path.
    const onPath = ["refresh.ts", "weather.ts", "calendars.ts", "store.ts", "mode.ts"];
    for (const f of onPath) {
      const text = fs.readFileSync(path.join(FEEDS_DIR, f), "utf8");
      expect(scanForAi(text), `${f} must not reference an AI client`).toBe(false);
    }
  });

  it("a full refresh completes with no AI client in the path", async () => {
    const at = "2026-11-19T09:00:00-05:00";
    connectFeed("josh_work", at, "josh");
    const result = await runRefresh();
    expect(result.weather.ok).toBe(true);
    expect(result.calendars.ok).toBe(true);
  });
});
