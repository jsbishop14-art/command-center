import { livePhone } from "./mode";
import { getSecret } from "../secrets";
import { monthStart, addMonths, monthsBetween, windowStart } from "./dates";
import { stubFtcMonth, type FtcMonthAgg } from "./stub";
import {
  getFtcState,
  setFtcState,
  setFtcMonth,
  pruneFtc,
  type FtcState,
} from "./store";

// FTC Do Not Call ingest (handoff §8.3). The FTC API cannot filter by number, so complaints are
// ingested as monthly aggregates (one row per number per month) and queried locally. Ordinary
// code, NO AI. The stub stands in everywhere except the Mac mini (livePhone).
//
// Modelled as month pages (newest-first), one page per month across the rolling 12-month window:
// faithful to the resumable, prune-as-you-go design the handoff describes, while keeping a single
// bounded set of pages the checks can drive. Decided without asking (logged in CC10-status): the
// handoff's day-paged real API is aggregated per month here; the stub is month-granular. Each page
// is idempotent (SET, not add), so a resumed or repeated page never double-counts.

type FtcSource = (monthYm01: string, todayYmd: string) => FtcMonthAgg[] | Promise<FtcMonthAgg[]>;

function source(): FtcSource {
  if (!livePhone()) return stubFtcMonth;
  return liveFtcMonth; // Mac mini only — never exercised by tests
}

// Initialise the backfill window the first time: cursor at the current month, target at current
// month − 11 (12 months inclusive).
export function initFtc(todayYmd: string, now: string): FtcState {
  const existing = getFtcState();
  if (existing) return existing;
  const s: FtcState = {
    syncedThrough: null,
    backfillCursor: monthStart(todayYmd),
    backfillTarget: windowStart(todayYmd),
    backfillDone: false,
    updatedAt: now,
  };
  setFtcState(s);
  return s;
}

// Process one backfill page (one month, newest-first) and advance the cursor. Writing the month
// and advancing the cursor happen in one transaction, so a crash mid-page cannot lose or
// double-count progress — a restart re-reads the saved cursor and resumes (handoff §8.3, spec §4).
export async function backfillStep(todayYmd: string, now: string): Promise<{ done: boolean; month: string | null }> {
  const s = initFtc(todayYmd, now);
  if (s.backfillDone || !s.backfillCursor || !s.backfillTarget) return { done: true, month: null };
  const month = s.backfillCursor;
  const aggs = await source()(month, todayYmd);
  const next = addMonths(month, -1);
  const done = monthsBetween(next, s.backfillTarget) < 0;
  for (const a of aggs) setFtcMonth(a, month);
  setFtcState({ ...s, backfillCursor: done ? null : next, backfillDone: done, updatedAt: now });
  return { done, month };
}

// Run the whole backfill to completion (handoff §8.3: ~1–3 days against the real API; instant
// against the stub). The 240-page cap is a safety backstop well above the 12-month window.
export async function runBackfill(todayYmd: string, now: string): Promise<number> {
  let pages = 0;
  for (;;) {
    const r = await backfillStep(todayYmd, now);
    pages++;
    if (r.done || pages > 240) break;
  }
  return pages;
}

// Daily ingest (handoff §8.3, ~2pm Eastern): re-pull the current month, advance synced_through and
// prune months that have fallen out of the rolling 12-month window.
export async function dailyIngest(todayYmd: string, now: string): Promise<{ pruned: number }> {
  const s = initFtc(todayYmd, now);
  const month = monthStart(todayYmd);
  for (const a of await source()(month, todayYmd)) setFtcMonth(a, month);
  const pruned = pruneFtc(todayYmd);
  setFtcState({ ...s, syncedThrough: todayYmd, updatedAt: now });
  return { pruned };
}

// Make sure the FTC data exists before a lookup. In stub mode (CI, build sessions, local dev) the
// backfill is instant, so run it lazily on first use — this is what gives a lookup its FTC counts
// without waiting for a timer. On the Mac mini (livePhone) the background job owns the ingest, so
// this is a no-op there.
export async function ensureFtcData(todayYmd: string, now: string): Promise<void> {
  if (livePhone()) return;
  const s = getFtcState();
  if (s && s.backfillDone && s.syncedThrough) return;
  await runBackfill(todayYmd, now);
  await dailyIngest(todayYmd, now);
}

// Progress for the screen's status line (handoff §8.6): percent of the 12-month backfill done, and
// the date the daily ingest is current through.
export function backfillProgress(todayYmd: string): { pct: number; done: boolean; syncedThrough: string | null } {
  const s = getFtcState();
  if (!s) return { pct: 0, done: false, syncedThrough: null };
  if (s.backfillDone) return { pct: 100, done: true, syncedThrough: s.syncedThrough };
  const processed = s.backfillCursor ? Math.max(0, monthsBetween(monthStart(todayYmd), s.backfillCursor)) : 12;
  const pct = Math.min(100, Math.round((processed / 12) * 100));
  return { pct, done: false, syncedThrough: s.syncedThrough };
}

// ---- Live source (Mac mini only, never exercised by tests) -------------------------------------

type FtcApiRow = {
  attributes?: Record<string, unknown>;
} & Record<string, unknown>;

// Page the dnc-complaints API over one month's created_date range and aggregate per number. Field
// names and the response shape are verified against the live API before go-live (handoff §8.3).
async function liveFtcMonth(monthYm01: string, _todayYmd: string): Promise<FtcMonthAgg[]> {
  const key = getSecret("ftc_api_key");
  if (!key) throw new Error("FTC (api.data.gov) key is not set");
  const from = monthYm01;
  const to = addMonths(monthYm01, 1); // exclusive upper bound
  const acc = new Map<string, { complaints: number; robocalls: number; lastSeen: string; subject: string }>();
  for (let page = 1; page <= 2000; page++) {
    const url =
      `https://api.ftc.gov/v0/dnc-complaints?created_date_min=${from}&created_date_max=${to}` +
      `&items_per_page=50&page=${page}`;
    const res = await fetch(url, { headers: { "X-Api-Key": key } });
    if (!res.ok) throw new Error(`FTC ingest failed: ${res.status}`);
    const body = (await res.json()) as { data?: FtcApiRow[] };
    const rows = body.data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const a = (row.attributes ?? row) as Record<string, unknown>;
      const raw = String(a["company-phone-number"] ?? a["phone-number"] ?? "");
      const phone = raw.replace(/\D/g, "").slice(-10);
      if (phone.length !== 10) continue;
      const created = String(a["created-date"] ?? a["created_date"] ?? "").slice(0, 10);
      const robo = /robo|prerecord/i.test(String(a["violation-type"] ?? a["subject"] ?? ""));
      const subject = String(a["subject"] ?? a["violation-type"] ?? "");
      const cur = acc.get(phone) ?? { complaints: 0, robocalls: 0, lastSeen: created, subject };
      cur.complaints += 1;
      if (robo) cur.robocalls += 1;
      if (created && created > cur.lastSeen) cur.lastSeen = created;
      acc.set(phone, cur);
    }
  }
  return [...acc.entries()].map(([phone, v]) => ({
    phone,
    complaints: v.complaints,
    robocalls: v.robocalls,
    lastSeen: v.lastSeen,
    topSubject: v.subject,
  }));
}
