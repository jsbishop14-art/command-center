import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { useTempDb } from "./helpers";
import { getDb } from "../../src/lib/db";
import { runMigrations } from "../../src/lib/migrations";
import { normalizePhone, looksLikePhone, formatPhone } from "../../src/lib/phone/normalize";
import { scorePhone, hasRegisteredName, verdictFromScore } from "../../src/lib/phone/scoring";
import { DEFAULT_SCORING, getScoringConfig, setScoringConfig } from "../../src/lib/phone/config";
import { getTwilio, twilioFetchCount, resetTwilioFetchCount } from "../../src/lib/phone/twilio";
import { fccLookup } from "../../src/lib/phone/fcc";
import { runBackfill, backfillStep, dailyIngest, backfillProgress } from "../../src/lib/phone/ftc";
import {
  ftcSummaryFor,
  pruneFtc,
  setFtcMonth,
  getFtcState,
  setMark,
  getMark,
  removeMark,
  recordLookup,
  listHistory,
  pruneHistory,
} from "../../src/lib/phone/store";
import { windowStart, addMonths, formatShortDate } from "../../src/lib/phone/dates";
import { runLookup, reopenLookup } from "../../src/lib/phone/lookup";
import { issueShortcutToken, revokeShortcutToken, isValidShortcutToken } from "../../src/lib/shortcut";
import type { FccData } from "../../src/lib/phone/stub";

// CC10 phone lookup (handoff §8, spec §4). Everything runs against the stubs — no real Twilio, FTC
// or FCC call (spec §6; CLAUDE §3). No AI anywhere. The 80%-test-list check is Josh's, after keys.

const TODAY = "2026-11-19";
const NOW = "2026-11-19T10:00:00-05:00";

function migrate() {
  useTempDb();
  runMigrations(getDb());
}

describe("normalize (handoff §8.2, §8.6): any US number in any format; non-US rejected", () => {
  beforeEach(migrate);

  it("accepts a number in any format and formats it", () => {
    for (const input of ["(561) 555-0123", "561.555.0123", "561 555 0123", "+1 561 555 0123", "15615550123", "5615550123"]) {
      const n = normalizePhone(input);
      expect(n?.phone).toBe("5615550123");
      expect(n?.e164).toBe("+15615550123");
      expect(n?.display).toBe("(561) 555-0123");
    }
  });

  it("extracts a number from pasted text", () => {
    expect(normalizePhone("Call me at (561) 555-0123 tomorrow")?.phone).toBe("5615550123");
    expect(looksLikePhone("ring 800-555-0144 about the quote")).toBe(true);
  });

  it("rejects what is not a US (NANP) number", () => {
    for (const bad of ["", "hello", "12345", "555-0123", "1115550123", "0005550123"]) {
      expect(normalizePhone(bad)).toBeNull();
      expect(looksLikePhone(bad)).toBe(false);
    }
  });

  it("formatPhone formats a stored 10-digit number", () => {
    expect(formatPhone("8005550144")).toBe("(800) 555-0144");
  });
});

describe("scoring (handoff §8.4): points, thresholds, verdicts", () => {
  const C = DEFAULT_SCORING;

  it("FTC tiers add the right points with a plain reason", () => {
    const base = { callerType: "", lineType: "mobile", carrier: "", callerName: "X Co" };
    const fcc = { available: true, count: 0, lastDate: null, callTypes: [] };
    const s1 = scorePhone({ twilio: base, ftc: { count: 1, robocalls: 0, lastSeen: "2026-11-10", topSubject: "" }, fcc, config: C });
    const s2 = scorePhone({ twilio: base, ftc: { count: 5, robocalls: 0, lastSeen: "2026-11-10", topSubject: "" }, fcc, config: C });
    const s3 = scorePhone({ twilio: base, ftc: { count: 14, robocalls: 0, lastSeen: "2026-10-28", topSubject: "" }, fcc, config: C });
    expect(s1.score).toBe(2);
    expect(s2.score).toBe(3);
    expect(s3.score).toBe(4);
    expect(s3.reasons[0]).toContain("14 FTC complaints in the last 12 months (most recent Oct 28)");
  });

  it("line type, generic name, robocall and the clean-personal bonus", () => {
    const fcc0 = { available: true, count: 0, lastDate: null, callTypes: [] };
    // nonFixedVoip (+2) + no name (+1) + robocall (+1)
    const spammy = scorePhone({
      twilio: { callerName: "", callerType: "", lineType: "nonFixedVoip", carrier: "" },
      ftc: { count: 0, robocalls: 1, lastSeen: null, topSubject: "" },
      fcc: fcc0,
      config: C,
    });
    expect(spammy.score).toBe(4);
    expect(spammy.verdict).toBe("telemarketer");

    // CONSUMER personal name, mobile, zero complaints → −2
    const person = scorePhone({
      twilio: { callerName: "Maria Gomez", callerType: "CONSUMER", lineType: "mobile", carrier: "" },
      ftc: { count: 0, robocalls: 0, lastSeen: null, topSubject: "" },
      fcc: fcc0,
      config: C,
    });
    expect(person.score).toBe(-2);
    expect(person.verdict).toBe("real");
  });

  it("verdict bands follow the thresholds", () => {
    expect(verdictFromScore(4, C)).toBe("telemarketer");
    expect(verdictFromScore(3, C)).toBe("unclear");
    expect(verdictFromScore(2, C)).toBe("unclear");
    expect(verdictFromScore(1, C)).toBe("real");
    expect(verdictFromScore(-2, C)).toBe("real");
  });

  it("generic names (empty, WIRELESS CALLER, a state) are not a registered name", () => {
    expect(hasRegisteredName("")).toBe(false);
    expect(hasRegisteredName("WIRELESS CALLER")).toBe(false);
    expect(hasRegisteredName("Florida")).toBe(false);
    expect(hasRegisteredName("Maria Gomez")).toBe(true);
  });

  it("an FCC-unavailable result still scores and notes it", () => {
    const r = scorePhone({
      twilio: { callerName: "Solar Pro LLC", callerType: "BUSINESS", lineType: "mobile", carrier: "" },
      ftc: { count: 1, robocalls: 0, lastSeen: "2026-11-10", topSubject: "" },
      fcc: { available: false, count: 0, lastDate: null, callTypes: [] },
      config: C,
    });
    expect(r.reasons).toContain("FCC data unavailable");
    expect(r.score).toBe(2); // FTC low tier only; no FCC points
  });
});

describe("scoring config (spec §3): one editable config file", () => {
  beforeEach(migrate);
  it("defaults, then an edit changes the outcome and persists", () => {
    expect(getScoringConfig().telemarketer).toBe(4);
    setScoringConfig({ ftcHigh: 9, telemarketer: 8 });
    const c = getScoringConfig();
    expect(c.ftcHigh).toBe(9);
    expect(c.telemarketer).toBe(8);
    expect(c.ftcLow).toBe(DEFAULT_SCORING.ftcLow); // untouched fields keep defaults
  });
});

describe("Twilio cache (spec §3): no paid repeat call within 30 days", () => {
  beforeEach(() => {
    migrate();
    resetTwilioFetchCount();
  });

  it("caches 30 days; refresh and >30 days refetch", async () => {
    const a = await getTwilio("5615550199", "+15615550199", { at: NOW });
    expect(a.cached).toBe(false);
    expect(twilioFetchCount()).toBe(1);

    const b = await getTwilio("5615550199", "+15615550199", { at: "2026-11-25T10:00:00-05:00" });
    expect(b.cached).toBe(true); // within 30 days
    expect(twilioFetchCount()).toBe(1); // NO new call

    const c = await getTwilio("5615550199", "+15615550199", { refresh: true, at: "2026-11-25T10:00:00-05:00" });
    expect(c.cached).toBe(false);
    expect(twilioFetchCount()).toBe(2); // Refresh forces a call

    const d = await getTwilio("5615550199", "+15615550199", { at: "2027-01-05T10:00:00-05:00" });
    expect(d.cached).toBe(false); // >30 days later
    expect(twilioFetchCount()).toBe(3);
  });
});

describe("FTC ingest (handoff §8.3, spec §4): resumable backfill, daily prune", () => {
  beforeEach(migrate);

  it("backfill stops and resumes without losing or double-counting progress", async () => {
    // Process three months, then "restart" (re-read state) and finish.
    await backfillStep(TODAY, NOW);
    await backfillStep(TODAY, NOW);
    await backfillStep(TODAY, NOW);
    const mid = getFtcState();
    expect(mid?.backfillDone).toBe(false);
    expect(mid?.backfillCursor).not.toBeNull();

    const pages = await runBackfill(TODAY, NOW); // resumes from the saved cursor
    expect(pages).toBeGreaterThan(0);
    const done = getFtcState();
    expect(done?.backfillDone).toBe(true);
    expect(done?.backfillCursor).toBeNull();

    // 2 complaints/month × 12 months = 24 for the heavy robocaller; idempotent SET, no double count.
    const sum = ftcSummaryFor("5615550111", TODAY);
    expect(sum.count).toBe(24);
    expect(sum.robocalls).toBe(24);
    // Running the backfill again changes nothing.
    await runBackfill(TODAY, NOW);
    expect(ftcSummaryFor("5615550111", TODAY).count).toBe(24);
  });

  it("the other seeded tiers land as expected", async () => {
    await runBackfill(TODAY, NOW);
    expect(ftcSummaryFor("8005550144", TODAY).count).toBe(6); // 1/mo × 6
    expect(ftcSummaryFor("5615550199", TODAY).count).toBe(1); // current month only
    expect(ftcSummaryFor("5615550170", TODAY).count).toBe(0); // a real person
  });

  it("the daily ingest prunes months older than 12 months", async () => {
    await runBackfill(TODAY, NOW);
    // Plant a row one month before the window and prove it is pruned.
    const old = addMonths(windowStart(TODAY), -1);
    setFtcMonth({ phone: "5615550111", complaints: 9, robocalls: 0, lastSeen: `${old.slice(0, 7)}-10`, topSubject: "old" }, old);
    expect(ftcSummaryFor("5615550111", TODAY).count).toBe(24); // outside the window, not summed
    const removed = (await dailyIngest(TODAY, NOW)).pruned;
    expect(removed).toBeGreaterThanOrEqual(1);
    const db = getDb();
    const stillOld = db.prepare("SELECT 1 FROM ftc_counts WHERE phone = ? AND month = ?").get("5615550111", old);
    expect(stillOld).toBeUndefined();
  });

  it("progress reaches 100% and reports the synced-through date", async () => {
    await runBackfill(TODAY, NOW);
    await dailyIngest(TODAY, NOW);
    const p = backfillProgress(TODAY);
    expect(p.pct).toBe(100);
    expect(p.done).toBe(true);
    expect(p.syncedThrough).toBe(TODAY);
  });

  it("pruneFtc removes rows before the window (direct)", () => {
    const old = addMonths(windowStart(TODAY), -2);
    setFtcMonth({ phone: "5615550111", complaints: 3, robocalls: 0, lastSeen: `${old.slice(0, 7)}-01`, topSubject: "x" }, old);
    expect(pruneFtc(TODAY)).toBe(1);
  });
});

describe("FCC (handoff §8.3, spec §4 check 4): a timeout still returns a result", () => {
  beforeEach(migrate);

  it("the stub returns counts for a seeded number", async () => {
    const r = await fccLookup("5615550111", TODAY);
    expect(r.available).toBe(true);
    expect(r.count).toBe(5);
  });

  it("a timeout yields available:false (no throw)", async () => {
    const never: () => Promise<FccData> = () => new Promise(() => {});
    const r = await fccLookup("5615550111", TODAY, { fetcher: never, timeoutMs: 20 });
    expect(r.available).toBe(false);
    expect(r.count).toBe(0);
  });

  it("an error yields available:false (no throw)", async () => {
    const boom = () => Promise.reject(new Error("socrata 500"));
    const r = await fccLookup("5615550111", TODAY, { fetcher: boom });
    expect(r.available).toBe(false);
  });
});

describe("marks (handoff §8.4): override the verdict for both users; remove restores scoring", () => {
  beforeEach(migrate);

  it("a Josh spam mark shows for Christine's lookup and overrides the verdict", async () => {
    setMark("8005550144", "spam", "josh", "robocall", NOW);
    const asChristine = await runLookup({ input: "8005550144", source: "desktop", user: "christine", at: NOW });
    expect(asChristine.mark?.by).toBe("Josh");
    expect(asChristine.verdictLabel).toBe("Marked spam by Josh");
    expect(asChristine.verdict).toBe("telemarketer");
    // Removing the mark restores scoring on the next lookup.
    removeMark("8005550144");
    const after = await runLookup({ input: "8005550144", source: "desktop", user: "christine", at: NOW });
    expect(after.mark).toBeNull();
    expect(after.verdictLabel).toBe("Likely telemarketer"); // scored, not marked
  });

  it("a real mark reads green", async () => {
    setMark("5615550111", "real", "christine", "", NOW);
    expect(getMark("5615550111")?.label).toBe("real");
    const r = await runLookup({ input: "5615550111", source: "desktop", user: "josh", at: NOW });
    expect(r.verdict).toBe("real");
    expect(r.verdictLabel).toBe("Marked real by Christine");
  });
});

describe("lookup orchestrator (handoff §8.1): full result, history, attribution", () => {
  beforeEach(() => {
    migrate();
    resetTwilioFetchCount();
  });

  it("returns a verdict with reasons for a known spammer and records history", async () => {
    const r = await runLookup({ input: "(561) 555-0111", source: "desktop", user: "josh", at: NOW });
    expect(r.verdict).toBe("telemarketer");
    expect(r.ftc.count).toBe(24);
    expect(r.fcc.count).toBe(5);
    expect(r.reasons.length).toBeGreaterThan(0);
    const hist = listHistory();
    expect(hist.length).toBe(1);
    expect(hist[0].phone).toBe("5615550111");
    expect(hist[0].user).toBe("josh");
  });

  it("a repeat lookup within 30 days makes no Twilio call (spec check: no repeat call)", async () => {
    await runLookup({ input: "5615550170", source: "desktop", user: "josh", at: NOW });
    expect(twilioFetchCount()).toBe(1);
    await runLookup({ input: "5615550170", source: "shortcut", user: "josh", at: "2026-11-25T10:00:00-05:00" });
    expect(twilioFetchCount()).toBe(1); // cached, no new paid call
  });

  it("reopen re-renders the stored result without a new Twilio call", async () => {
    await runLookup({ input: "5615550199", source: "desktop", user: "josh", at: NOW });
    const before = twilioFetchCount();
    const re = reopenLookup("5615550199");
    expect(re?.phone).toBe("5615550199");
    expect(twilioFetchCount()).toBe(before); // no new call on reopen
  });

  it("rejects an unrecognized number", async () => {
    await expect(runLookup({ input: "nope", source: "desktop", user: "josh", at: NOW })).rejects.toThrow();
  });

  it("history lists the latest per number and searches by number or name", async () => {
    await runLookup({ input: "5615550111", source: "desktop", user: "josh", at: NOW });
    await runLookup({ input: "5615550170", source: "desktop", user: "christine", at: NOW });
    expect(listHistory().length).toBe(2);
    expect(listHistory("561555").length).toBe(2);
    expect(listHistory("maria").length).toBe(1); // caller name match
    expect(listHistory("0111").length).toBe(1);
  });
});

describe("history prune (handoff §8.5): older than 90 days is deleted", () => {
  beforeEach(migrate);

  it("drops rows older than 90 days, keeps recent ones", () => {
    recordLookup({ phone: "5615550111", verdict: "telemarketer", score: 9, reasons: [], detail: {}, source: "desktop", user: "josh", createdAt: "2026-06-01T10:00:00-04:00" });
    recordLookup({ phone: "5615550170", verdict: "real", score: -2, reasons: [], detail: {}, source: "desktop", user: "josh", createdAt: NOW });
    const removed = pruneHistory(NOW, 90);
    expect(removed).toBe(1);
    const left = listHistory();
    expect(left.length).toBe(1);
    expect(left[0].phone).toBe("5615550170");
  });
});

describe("dates helper", () => {
  it("formatShortDate and window math", () => {
    expect(formatShortDate("2026-10-28")).toBe("Oct 28");
    expect(formatShortDate("")).toBe("");
    expect(windowStart("2026-11-19")).toBe("2025-12-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});

describe("Shortcut token (handoff §8.7, spec §4): works, then stops once revoked", () => {
  beforeEach(migrate);
  it("a valid token matches; a revoked token refuses everything", () => {
    const token = issueShortcutToken(NOW);
    expect(isValidShortcutToken(token)).toBe(true);
    expect(isValidShortcutToken("wrong")).toBe(false);
    revokeShortcutToken();
    expect(isValidShortcutToken(token)).toBe(false); // phone + note routes now refuse it
  });
});

describe("no AI (CLAUDE §3, spec §3): nothing in phone imports a Claude/Anthropic client", () => {
  it("no import line references anthropic or a claude client", () => {
    const dirs = [
      path.resolve("src/lib/phone"),
      path.resolve("src/app/(app)/phone"),
      path.resolve("src/app/api/phone"),
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        for (const line of fs.readFileSync(full, "utf8").split("\n")) {
          if (/\bimport\b/.test(line) && /anthropic|\/claude|claude-/i.test(line)) offenders.push(`${full}: ${line.trim()}`);
        }
      }
    };
    for (const d of dirs) walk(d);
    expect(offenders).toEqual([]);
  });
});
