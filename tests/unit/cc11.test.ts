import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useTempDb, useTempKanban, TEST_SECRET_KEY } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { ensureLayout } from "../../src/lib/kanban/store";
import { listPending } from "../../src/lib/kanban/pending";
import { todayEastern } from "../../src/lib/kanban/time";

import {
  consumePending,
  scopesFor,
  writeBundle,
  hasConnection,
  listFeedProblems,
  listCalendarEvents,
  __setStubRevoked,
  parseTarget,
  type Target,
} from "../../src/lib/feeds/google";
import { startConnect, finishConnect, disconnect } from "../../src/lib/feeds/connections";
import { fetchCalendarEvents } from "../../src/lib/feeds/calendars";
import { setFeedConnectedAt } from "../../src/lib/feeds/store";
import { intakeConnected, gmailConnected } from "../../src/lib/feeds/gmail";
import { pollIntake } from "../../src/lib/feeds/intake";
import { awaitingReply } from "../../src/lib/feeds/awaiting";
import { nudge } from "../../src/lib/feeds/nudge";
import { draftsLog } from "../../src/lib/feeds/gmail";

import { createProposal, ezbOutbound, SLIP_RULE_NAME } from "../../src/lib/ezbinder/proposals";
import { stubProposalLog, clearStubProposalLog } from "../../src/lib/ezbinder/stub";

import {
  stageBuild,
  activateBuild,
  restoreBuild,
  LIVE_DIR,
  STAGING_DIR,
  PREV_DIR,
  type BuildOps,
} from "../../scripts/updater/build";

// CC11 spec §4 checks, all against the stubs. No AI anywhere; no real Google, EZ Binder or
// Cloudflare call; the app never sends email.

const CAL: Target = { kind: "calendar", slug: "josh_work" };
const DATE = todayEastern();

function fresh() {
  process.env.CC_SECRET_KEY = TEST_SECRET_KEY;
  useTempDb();
  useTempKanban();
  runMigrations(getDb());
  ensureLayout();
}

// Drive the OAuth flow end-to-end against the stub Google (as the callback route does): start a
// connect, read the pending state, then finish with a stub code.
async function connectStub(t: Target, by = "josh"): Promise<void> {
  startConnect(t, by, "2026-11-19T09:00:00-05:00");
  const row = getDb().prepare("SELECT state FROM google_oauth_pending WHERE target = ?").get(
    t.kind === "calendar" ? `cal:${t.slug}` : t.kind,
  ) as { state: string } | undefined;
  const result = await finishConnect(row!.state, `stub-code-${row!.state}`, "2026-11-19T09:00:00-05:00");
  expect(result.ok).toBe(true);
}

describe("CC11 check 1/3: connect/refresh/disconnect on the live code path (stub Google)", () => {
  beforeEach(() => {
    fresh();
    process.env.CC_LIVE_FEEDS = "1"; // the live code path; no client creds → stub transport
    __setStubRevoked(null);
  });
  afterEach(() => {
    delete process.env.CC_LIVE_FEEDS;
    __setStubRevoked(null);
  });

  it("an unconnected calendar returns no events on the live path", async () => {
    expect(hasConnection(CAL)).toBe(false);
    expect(await fetchCalendarEvents("josh_work", DATE, null)).toHaveLength(0);
  });

  it("connect stores a token bundle and the Today panel shows stub events (check 3)", async () => {
    await connectStub(CAL);
    expect(hasConnection(CAL)).toBe(true);
    const events = await fetchCalendarEvents("josh_work", DATE, null);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.title === "Site visit — Riverwood")).toBe(true);
  });

  it("the OAuth state is one-time: it cannot be replayed", async () => {
    startConnect(CAL, "josh", "2026-11-19T09:00:00-05:00");
    const row = getDb().prepare("SELECT state FROM google_oauth_pending WHERE target = 'cal:josh_work'").get() as {
      state: string;
    };
    expect(consumePending(row.state)).toBeTruthy();
    expect(consumePending(row.state)).toBeNull(); // consumed; a replay fails
  });

  it("Gmail and the intake mailbox connect separately", async () => {
    await connectStub({ kind: "gmail" });
    await connectStub({ kind: "intake" });
    expect(gmailConnected()).toBe(true);
    expect(intakeConnected()).toBe(true);
    // The intake address defaults to the dedicated account on connect (CC4-ASK-1).
    const addr = getDb().prepare("SELECT value FROM app_settings WHERE key = 'intake_address'").get() as {
      value: string;
    };
    expect(addr.value).toBe("evanmbishop23@gmail.com");
  });

  it("disconnect clears the token and events", async () => {
    await connectStub(CAL);
    expect((await fetchCalendarEvents("josh_work", DATE, null)).length).toBeGreaterThan(0);
    disconnect(CAL);
    expect(hasConnection(CAL)).toBe(false);
    expect(await fetchCalendarEvents("josh_work", DATE, null)).toHaveLength(0);
  });
});

describe("CC11 check 2: an expired/revoked token raises a Problem with Reconnect that restores the feed", () => {
  beforeEach(() => {
    fresh();
    process.env.CC_LIVE_FEEDS = "1";
    __setStubRevoked(null);
  });
  afterEach(() => {
    delete process.env.CC_LIVE_FEEDS;
    __setStubRevoked(null);
  });

  it("a revoked refresh raises a feed Problem; Reconnect clears it and the events return", async () => {
    await connectStub(CAL);
    // Force the stored token to be expired so the next read must refresh, and make the stub reject
    // that refresh (revoked).
    writeBundle(
      CAL,
      {
        accessToken: "stale",
        refreshToken: "stub-refresh-cal:josh_work",
        expiry: "2000-01-01T00:00:00.000Z",
        scope: scopesFor(CAL).join(" "),
        account: "josh@worthprop.com",
      },
      "test",
    );
    __setStubRevoked(CAL);

    const events = await listCalendarEvents("josh_work", DATE);
    expect(events).toHaveLength(0); // does not throw up the stack
    const problems = listFeedProblems();
    expect(problems.map((p) => p.target)).toContain("cal:josh_work");

    // Reconnect: a fresh sign-in clears the Problem and the feed resumes.
    __setStubRevoked(null);
    await connectStub(CAL);
    expect(listFeedProblems().map((p) => p.target)).not.toContain("cal:josh_work");
    expect((await listCalendarEvents("josh_work", DATE)).length).toBeGreaterThan(0);
  });
});

describe("CC11 check 4: intake on the live path makes one note per message, no duplicates", () => {
  beforeEach(() => {
    fresh();
    process.env.CC_LIVE_FEEDS = "1";
  });
  afterEach(() => {
    delete process.env.CC_LIVE_FEEDS;
  });

  it("a second poll over the same messages creates no duplicate note", () => {
    const first = pollIntake("2026-11-19T12:00:00-05:00");
    expect(first.created.length).toBe(2);
    const second = pollIntake("2026-11-19T12:05:00-05:00");
    expect(second.created.length).toBe(0);
    expect(second.skipped).toBe(2);
    expect(listPending()).toHaveLength(2);
  });
});

describe("CC11 check 5: Awaiting reply and nudge drafts work on the live path; no send scope, no send call", () => {
  beforeEach(() => {
    fresh();
    process.env.CC_LIVE_FEEDS = "1";
  });
  afterEach(() => {
    delete process.env.CC_LIVE_FEEDS;
  });

  const NOW = new Date("2026-11-19T12:00:00-05:00");

  it("Awaiting reply lists flagged threads and Nudge creates a draft (never a send)", () => {
    const items = awaitingReply(NOW);
    expect(items.length).toBeGreaterThan(0);
    const before = draftsLog().length;
    const draft = nudge(items[0].id, NOW.toISOString());
    expect(draft.to).toBe(items[0].to);
    expect(draftsLog().length).toBe(before + 1); // a draft was created
  });

  it("no requested Gmail scope is a send scope", () => {
    const gmailScopes = scopesFor({ kind: "gmail" });
    const intakeScopes = scopesFor({ kind: "intake" });
    for (const s of [...gmailScopes, ...intakeScopes]) {
      expect(/\.send\b/.test(s)).toBe(false);
      expect(s.includes("gmail.send")).toBe(false);
    }
    // The draft scope is compose (create drafts), and read is readonly.
    expect(gmailScopes).toContain("https://www.googleapis.com/auth/gmail.compose");
    expect(gmailScopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
  });

  it("the Google client has no Gmail send endpoint or send scope (static scan)", () => {
    const google = readFileSync(path.join(process.cwd(), "src/lib/feeds/google.ts"), "utf8");
    const gmail = readFileSync(path.join(process.cwd(), "src/lib/feeds/gmail.ts"), "utf8");
    for (const src of [google, gmail]) {
      expect(src).not.toMatch(/gmail\.send/);
      expect(src).not.toMatch(/messages\/send/);
      expect(src).not.toMatch(/drafts\/send/);
      expect(src).not.toMatch(/\/send\b/);
    }
    // The only Gmail write is draft creation.
    expect(google).toMatch(/users\/me\/drafts/);
  });
});

describe("CC11 check 6: Josh and rule schedule moves post as actor claude with a source note", () => {
  beforeEach(() => {
    fresh();
    clearStubProposalLog();
  });

  it("ezbOutbound maps the real source to the Claude actor and a sourced note", () => {
    expect(ezbOutbound("josh", "shift tile")).toEqual({ actor: "claude", note: "moved by Josh — shift tile" });
    expect(ezbOutbound("rule", "slip")).toEqual({
      actor: "claude",
      note: `moved by rule: ${SLIP_RULE_NAME} — slip`,
    });
    expect(ezbOutbound("claude", "x")).toEqual({ actor: "claude", note: "x" });
  });

  it("a Josh move posts X-EZB-Actor claude with 'moved by Josh' in the note", async () => {
    await createProposal(
      { jobId: "J1", taskId: "T1", source: "josh", toStart: "2026-12-01", toEnd: "2026-12-03", note: "shift" },
      { at: "2026-11-19T09:00:00-05:00" },
    );
    const sent = stubProposalLog().at(-1)!;
    expect(sent.actor).toBe("claude");
    expect(sent.note).toContain("moved by Josh");
  });

  it("a rule move posts X-EZB-Actor claude with 'moved by rule' in the note", async () => {
    await createProposal(
      { jobId: "J1", taskId: "T2", source: "rule", toStart: "2026-12-01", toEnd: "2026-12-03", note: "slip 2d" },
      { at: "2026-11-19T09:00:00-05:00" },
    );
    const sent = stubProposalLog().at(-1)!;
    expect(sent.actor).toBe("claude");
    expect(sent.note).toContain("moved by rule");
  });
});

describe("CC11 check 8: the updater builds into staging and switches only after a successful build", () => {
  // A fake filesystem recording what exists, so build-and-switch is tested without a real build.
  function fakeOps(opts?: { buildThrows?: boolean }) {
    const dirs = new Set<string>([LIVE_DIR]); // the live build is already being served
    const built: string[] = [];
    const ops: BuildOps = {
      runBuild: (distDir) => {
        if (opts?.buildThrows) throw new Error("next build failed");
        built.push(distDir);
        dirs.add(distDir);
      },
      exists: (p) => dirs.has(p.replace(/^\.\//, "")),
      rm: (p) => dirs.delete(p.replace(/^\.\//, "")),
      rename: (from, to) => {
        const f = from.replace(/^\.\//, "");
        const t = to.replace(/^\.\//, "");
        if (dirs.delete(f)) dirs.add(t);
      },
    };
    return { ops, dirs, built };
  }

  it("builds into the staging dir and leaves the served build untouched during the build", () => {
    const { ops, dirs, built } = fakeOps();
    stageBuild(ops, "");
    expect(built).toEqual([STAGING_DIR]); // built into staging, not .next
    expect(dirs.has(LIVE_DIR)).toBe(true); // the served build is untouched
    expect(dirs.has(STAGING_DIR)).toBe(true);
  });

  it("activate switches staging in and keeps the previous build for rollback", () => {
    const { ops, dirs } = fakeOps();
    stageBuild(ops, "");
    activateBuild(ops, "");
    expect(dirs.has(LIVE_DIR)).toBe(true); // now serving the new build
    expect(dirs.has(STAGING_DIR)).toBe(false); // staging moved into place
    expect(dirs.has(PREV_DIR)).toBe(true); // old build kept for rollback
  });

  it("a failed build cleans up staging and leaves the served build untouched", () => {
    const { ops, dirs } = fakeOps({ buildThrows: true });
    expect(() => stageBuild(ops, "")).toThrow();
    expect(dirs.has(STAGING_DIR)).toBe(false);
    expect(dirs.has(LIVE_DIR)).toBe(true); // never replaced
  });

  it("restore rolls the live build back to the previous one after a bad switch", () => {
    const { ops, dirs } = fakeOps();
    stageBuild(ops, "");
    activateBuild(ops, "");
    restoreBuild(ops, "");
    expect(dirs.has(LIVE_DIR)).toBe(true); // the previous build is live again
    expect(dirs.has(PREV_DIR)).toBe(false);
  });
});

describe("CC11: targets parse and the connect flow rejects unknown ones", () => {
  it("parses calendar, gmail and intake targets", () => {
    expect(parseTarget("cal:josh_work")).toEqual({ kind: "calendar", slug: "josh_work" });
    expect(parseTarget("gmail")).toEqual({ kind: "gmail" });
    expect(parseTarget("intake")).toEqual({ kind: "intake" });
    expect(parseTarget("nope")).toBeNull();
  });
});

// Keep a reference so the import of setFeedConnectedAt is used (connect flow relies on it); a no-op
// guard that also documents that marking connected does not require a token write.
describe("CC11: setFeedConnectedAt marks a calendar connected", () => {
  it("sets connected_at without a token", () => {
    fresh();
    setFeedConnectedAt("josh_work", "2026-11-19T09:00:00-05:00");
    const row = getDb().prepare("SELECT connected_at FROM calendar_feeds WHERE slug = 'josh_work'").get() as {
      connected_at: string | null;
    };
    expect(row.connected_at).toBe("2026-11-19T09:00:00-05:00");
  });
});
