import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb, useTempKanban, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { ensureLayout } from "../../src/lib/kanban/store";
import { listCards } from "../../src/lib/kanban/store";
import { listPending } from "../../src/lib/kanban/pending";

import * as gmail from "../../src/lib/feeds/gmail";
import { sentThreads, DEFAULT_TEMPLATE_B, connectGmail, draftsLog } from "../../src/lib/feeds/gmail";
import { flagThread, awaitingReply, dismissThread, isDismissed } from "../../src/lib/feeds/awaiting";
import { nudge, fillTemplate } from "../../src/lib/feeds/nudge";
import { pollIntake } from "../../src/lib/feeds/intake";
import { issueShortcutToken, revokeShortcutToken, isValidShortcutToken, rateLimitOk } from "../../src/lib/shortcut";
import { issueToken, resolveToken } from "../../src/lib/kanban/tokens";

// CC4 spec §4 and handoff §11 "Inbox and email". No AI in intake or Awaiting reply; the app never
// sends email (drafts only); the Shortcut token works on its routes only.

beforeEach(() => {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureLayout();
});

// A fixed "now" so the stub thread ages (34h, 77h, 12h, 31h) land either side of the boundaries.
const NOW = new Date("2026-11-19T12:00:00-05:00");

describe("Awaiting reply rule (handoff §11: flags at 2 days, 1 day for active-job clients)", () => {
  it("flags a non-client thread at 2 days and an active-job client at 1 day", () => {
    const threads = sentThreads(NOW);
    const by = (id: string) => threads.find((t) => t.id === id)!;

    // 77h ≈ 3.2d to a non-client → 2-day rule → flagged.
    expect(flagThread(by("t-spark"), NOW)).toMatchObject({ flagged: true, threshold: 2, isClient: false });
    // 34h ≈ 1.4d to an active-job client → 1-day rule → flagged.
    expect(flagThread(by("t-riverwood"), NOW)).toMatchObject({ flagged: true, threshold: 1, isClient: true });
    // 31h ≈ 1.3d to a non-client → under 2 days → not flagged.
    expect(flagThread(by("t-tile"), NOW)).toMatchObject({ flagged: false, threshold: 2, isClient: false });
    // 12h ≈ 0.5d to an active-job client → under 1 day → not flagged.
    expect(flagThread(by("t-bnt"), NOW)).toMatchObject({ flagged: false, threshold: 1, isClient: true });
  });

  it("awaitingReply lists only the flagged threads, oldest first", () => {
    const items = awaitingReply(NOW);
    expect(items.map((i) => i.id)).toEqual(["t-spark", "t-riverwood"]);
    // The active-job client is labelled as a match; the non-client shows its address.
    expect(items.find((i) => i.id === "t-riverwood")!.matchLabel).toContain("Riverwood Build");
  });

  it("No reply needed removes only that thread, leaving the others (handoff §11)", () => {
    expect(awaitingReply(NOW).map((i) => i.id)).toContain("t-spark");
    dismissThread("t-spark", NOW.toISOString());
    expect(isDismissed("t-spark")).toBe(true);
    const after = awaitingReply(NOW).map((i) => i.id);
    expect(after).not.toContain("t-spark");
    expect(after).toContain("t-riverwood"); // the other thread is untouched
  });
});

describe("Nudge creates a Gmail draft from template B and sends nothing (spec check 1, handoff §11)", () => {
  it("template B ends at \"Thanks,\" and [first name] fills from the recipient", () => {
    expect(DEFAULT_TEMPLATE_B.trim().endsWith("Thanks,")).toBe(true);
    const filled = fillTemplate(DEFAULT_TEMPLATE_B, "Dana");
    expect(filled).toContain("Hi Dana,");
    expect(filled).not.toContain("[first name]");
    expect(filled.trim().endsWith("Thanks,")).toBe(true);
  });

  it("nudge records a draft (not a send) in the thread", () => {
    const before = draftsLog().length;
    const draft = nudge("t-riverwood", NOW.toISOString());
    expect(draft.threadId).toBe("t-riverwood");
    expect(draft.to).toBe("dana@riverwoodbuild.com");
    expect(draft.body.trim().endsWith("Thanks,")).toBe(true);
    expect(draftsLog().length).toBe(before + 1);
  });

  it("the Gmail stub exposes draft creation and NO send function (spec check 1)", () => {
    const names = Object.keys(gmail);
    expect(names).toContain("createDraft");
    // No exported function name mentions sending — the app never sends email (CLAUDE §8).
    expect(names.filter((n) => /send|deliver|dispatch/i.test(n))).toEqual([]);
    // And the Gmail/nudge source makes no send call.
    const src =
      fs.readFileSync(path.resolve(__dirname, "../../src/lib/feeds/gmail.ts"), "utf8") +
      fs.readFileSync(path.resolve(__dirname, "../../src/lib/feeds/nudge.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(/\.(send|sendMessage|sendDraft|deliver)\s*\(/i.test(code)).toBe(false);
  });
});

describe("Note intake (handoff §4.4, §11: notes arrive from email and text-to-email)", () => {
  it("creates a pending note per new intake message, one email and one text-to-email", () => {
    connectGmail(NOW.toISOString());
    const result = pollIntake(NOW.toISOString());
    expect(result.created.length).toBe(2);
    const vias = listPending().map((n) => n.via).sort();
    expect(vias).toEqual(["email", "sms"]);
    // Nothing became a card — notes wait for Confirm (spec §1).
    expect(listCards()).toHaveLength(0);
  });

  it("a second poll over the same messages creates no duplicate note", () => {
    connectGmail(NOW.toISOString());
    pollIntake(NOW.toISOString());
    const second = pollIntake(NOW.toISOString());
    expect(second.created.length).toBe(0);
    expect(second.skipped).toBe(2);
    expect(listPending()).toHaveLength(2);
  });
});

describe("Shortcut token works on its routes only (spec check 2, handoff §8.7)", () => {
  it("validates the issued token and refuses a wrong or revoked one", () => {
    const token = issueShortcutToken(NOW.toISOString());
    expect(isValidShortcutToken(token)).toBe(true);
    expect(isValidShortcutToken("not-the-token")).toBe(false);
    expect(isValidShortcutToken(null)).toBe(false);
    revokeShortcutToken();
    expect(isValidShortcutToken(token)).toBe(false);
  });

  it("the Shortcut token is not an action-layer token, and vice versa", () => {
    const shortcut = issueShortcutToken(NOW.toISOString());
    const claude = issueToken("claude", NOW.toISOString());
    // The action layer (/api/action) does not accept the Shortcut token.
    expect(resolveToken(shortcut)).toEqual({ denied: "no_token" });
    // The notes route does not accept a Claude action-layer token.
    expect(isValidShortcutToken(claude)).toBe(false);
  });

  it("rate limiter allows a burst then refuses, within the window", () => {
    const t0 = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < 40; i++) if (rateLimitOk(t0 + i)) allowed++;
    expect(allowed).toBe(30); // MAX_PER_WINDOW
    expect(rateLimitOk(t0 + 100)).toBe(false);
    // After the window passes, requests are allowed again.
    expect(rateLimitOk(t0 + 61_000)).toBe(true);
  });
});
