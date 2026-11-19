import { getDb } from "../db";
import { easternStamp } from "../kanban/time";
import { windowStart } from "./dates";
import type { TwilioData, FtcMonthAgg } from "./stub";

// Database side of phone lookup (handoff §8.5). Single household, no AI. All phone values are the
// bare 10 digits.

// ---- Twilio cache (30 days, handoff §8.3) ------------------------------------------------------

export type TwilioCacheRow = TwilioData & { phone: string; fetchedAt: string };

export function getTwilioCache(phone: string): TwilioCacheRow | null {
  const r = getDb()
    .prepare(
      `SELECT phone, caller_name AS callerName, caller_type AS callerType,
              line_type AS lineType, carrier, fetched_at AS fetchedAt
         FROM twilio_cache WHERE phone = ?`,
    )
    .get(phone) as TwilioCacheRow | undefined;
  return r ?? null;
}

export function putTwilioCache(phone: string, d: TwilioData, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO twilio_cache (phone, caller_name, caller_type, line_type, carrier, fetched_at)
       VALUES (@phone, @caller_name, @caller_type, @line_type, @carrier, @fetched_at)
       ON CONFLICT(phone) DO UPDATE SET
         caller_name = excluded.caller_name, caller_type = excluded.caller_type,
         line_type = excluded.line_type, carrier = excluded.carrier, fetched_at = excluded.fetched_at`,
    )
    .run({
      phone,
      caller_name: d.callerName,
      caller_type: d.callerType,
      line_type: d.lineType,
      carrier: d.carrier,
      fetched_at: at,
    });
}

// ---- FTC monthly counts ------------------------------------------------------------------------

// Set (not add) a month's aggregates for a number — the ingest re-pulls a whole month, so the SET
// is idempotent and a resumed/repeated page never double-counts (handoff §8.3).
export function setFtcMonth(a: FtcMonthAgg, month: string): void {
  getDb()
    .prepare(
      `INSERT INTO ftc_counts (phone, month, complaints, robocalls, last_seen, top_subject)
       VALUES (@phone, @month, @complaints, @robocalls, @last_seen, @top_subject)
       ON CONFLICT(phone, month) DO UPDATE SET
         complaints = excluded.complaints, robocalls = excluded.robocalls,
         last_seen = excluded.last_seen, top_subject = excluded.top_subject`,
    )
    .run({
      phone: a.phone,
      month,
      complaints: a.complaints,
      robocalls: a.robocalls,
      last_seen: a.lastSeen,
      top_subject: a.topSubject,
    });
}

export type FtcSummary = { count: number; robocalls: number; lastSeen: string | null; topSubject: string };

// The rolling-12-month FTC summary for a number, ending at the Eastern "today".
export function ftcSummaryFor(phone: string, todayYmd: string): FtcSummary {
  const from = windowStart(todayYmd);
  const r = getDb()
    .prepare(
      `SELECT COALESCE(SUM(complaints), 0) AS count, COALESCE(SUM(robocalls), 0) AS robocalls,
              MAX(last_seen) AS lastSeen
         FROM ftc_counts WHERE phone = ? AND month >= ?`,
    )
    .get(phone, from) as { count: number; robocalls: number; lastSeen: string | null };
  // top_subject from the most recent month with complaints.
  const s = getDb()
    .prepare(
      `SELECT top_subject AS topSubject FROM ftc_counts
         WHERE phone = ? AND month >= ? AND complaints > 0 ORDER BY month DESC LIMIT 1`,
    )
    .get(phone, from) as { topSubject: string } | undefined;
  return { count: r.count, robocalls: r.robocalls, lastSeen: r.lastSeen ?? null, topSubject: s?.topSubject ?? "" };
}

// Prune months older than the rolling 12-month window (handoff §8.3 daily prune). Returns rows removed.
export function pruneFtc(todayYmd: string): number {
  const from = windowStart(todayYmd);
  return getDb().prepare("DELETE FROM ftc_counts WHERE month < ?").run(from).changes;
}

// ---- FTC sync state (singleton row id = 1) -----------------------------------------------------

export type FtcState = {
  syncedThrough: string | null;
  backfillCursor: string | null;
  backfillTarget: string | null;
  backfillDone: boolean;
  updatedAt: string | null;
};

export function getFtcState(): FtcState | null {
  const r = getDb()
    .prepare(
      `SELECT synced_through AS syncedThrough, backfill_cursor AS backfillCursor,
              backfill_target AS backfillTarget, backfill_done AS backfillDone, updated_at AS updatedAt
         FROM ftc_sync_state WHERE id = 1`,
    )
    .get() as (Omit<FtcState, "backfillDone"> & { backfillDone: number }) | undefined;
  if (!r) return null;
  return { ...r, backfillDone: !!r.backfillDone };
}

export function setFtcState(s: FtcState): void {
  getDb()
    .prepare(
      `INSERT INTO ftc_sync_state (id, synced_through, backfill_cursor, backfill_target, backfill_done, updated_at)
       VALUES (1, @synced_through, @backfill_cursor, @backfill_target, @backfill_done, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         synced_through = excluded.synced_through, backfill_cursor = excluded.backfill_cursor,
         backfill_target = excluded.backfill_target, backfill_done = excluded.backfill_done,
         updated_at = excluded.updated_at`,
    )
    .run({
      synced_through: s.syncedThrough,
      backfill_cursor: s.backfillCursor,
      backfill_target: s.backfillTarget,
      backfill_done: s.backfillDone ? 1 : 0,
      updated_at: s.updatedAt,
    });
}

// ---- Marks (shared spam/real, handoff §8.4) ----------------------------------------------------

export type MarkRow = { phone: string; label: "spam" | "real"; note: string; user: string; createdAt: string };

export function getMark(phone: string): MarkRow | null {
  const r = getDb()
    .prepare("SELECT phone, label, note, user, created_at AS createdAt FROM phone_marks WHERE phone = ?")
    .get(phone) as MarkRow | undefined;
  return r ?? null;
}

export function setMark(phone: string, label: "spam" | "real", user: string, note: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO phone_marks (phone, label, note, user, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET
         label = excluded.label, note = excluded.note, user = excluded.user, created_at = excluded.created_at`,
    )
    .run(phone, label, note, user, at);
}

export function removeMark(phone: string): void {
  getDb().prepare("DELETE FROM phone_marks WHERE phone = ?").run(phone);
}

export function markedPhones(): Set<string> {
  const rows = getDb().prepare("SELECT phone FROM phone_marks").all() as { phone: string }[];
  return new Set(rows.map((r) => r.phone));
}

// ---- Lookup history (90 days, handoff §8.5, §8.6) ----------------------------------------------

export type LookupRow = {
  id: number;
  phone: string;
  verdict: string;
  score: number;
  reasons: string[];
  detail: Record<string, unknown>;
  source: "desktop" | "shortcut";
  user: string;
  createdAt: string;
};

type RawLookup = Omit<LookupRow, "reasons" | "detail"> & { reasons: string; detail: string };

function toLookup(r: RawLookup): LookupRow {
  let reasons: string[] = [];
  let detail: Record<string, unknown> = {};
  try {
    reasons = JSON.parse(r.reasons) as string[];
  } catch {
    /* corrupt row: show none */
  }
  try {
    detail = JSON.parse(r.detail) as Record<string, unknown>;
  } catch {
    /* corrupt row: show none */
  }
  return { ...r, reasons, detail };
}

export function recordLookup(l: Omit<LookupRow, "id">): number {
  const info = getDb()
    .prepare(
      `INSERT INTO phone_lookups (phone, verdict, score, reasons, detail, source, user, created_at)
       VALUES (@phone, @verdict, @score, @reasons, @detail, @source, @user, @created_at)`,
    )
    .run({
      phone: l.phone,
      verdict: l.verdict,
      score: l.score,
      reasons: JSON.stringify(l.reasons),
      detail: JSON.stringify(l.detail),
      source: l.source,
      user: l.user,
      created_at: l.createdAt,
    });
  return Number(info.lastInsertRowid);
}

// The most recent lookup for a number (used to re-open a result without a new lookup).
export function latestLookup(phone: string): LookupRow | null {
  const r = getDb()
    .prepare(
      `SELECT id, phone, verdict, score, reasons, detail, source, user, created_at AS createdAt
         FROM phone_lookups WHERE phone = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .get(phone) as RawLookup | undefined;
  return r ? toLookup(r) : null;
}

// History list: the most recent lookup per number (handoff §8.6 history is by number), newest
// first, optionally filtered by a search term against the number or caller name.
export function listHistory(search = ""): LookupRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, phone, verdict, score, reasons, detail, source, user, created_at AS createdAt
         FROM phone_lookups l
        WHERE id = (SELECT id FROM phone_lookups p WHERE p.phone = l.phone
                     ORDER BY created_at DESC, id DESC LIMIT 1)
        ORDER BY created_at DESC, id DESC`,
    )
    .all() as RawLookup[];
  const list = rows.map(toLookup);
  const q = search.trim().toLowerCase();
  if (!q) return list;
  const qDigits = q.replace(/\D/g, "");
  return list.filter((l) => {
    const name = String((l.detail as { callerName?: string }).callerName ?? "").toLowerCase();
    return (qDigits && l.phone.includes(qDigits)) || name.includes(q);
  });
}

// Delete history older than 90 days (handoff §8.5; the daily job). created_at rows are Eastern
// stamps (nowEastern), so the cutoff is stamped the same way to compare correctly. Returns rows
// removed.
export function pruneHistory(nowIso: string, days = 90): number {
  const cutoff = easternStamp(new Date(new Date(nowIso).getTime() - days * 24 * 60 * 60 * 1000));
  return getDb().prepare("DELETE FROM phone_lookups WHERE created_at < ?").run(cutoff).changes;
}
