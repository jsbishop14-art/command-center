import { nowEastern } from "../kanban/time";
import { normalizePhone } from "./normalize";
import { getTwilio } from "./twilio";
import { ensureFtcData } from "./ftc";
import { fccLookup, type FccFetcher, type FccResult } from "./fcc";
import { scorePhone, verdictFromScore, type Verdict } from "./scoring";
import { getScoringConfig } from "./config";
import {
  ftcSummaryFor,
  getMark,
  recordLookup,
  latestLookup,
  type FtcSummary,
  type MarkRow,
} from "./store";
import type { TwilioData } from "./stub";
import { VERDICT_LABEL, verdictForMark } from "./view";

// The lookup orchestrator (handoff §8.1–§8.6). Ordinary code, NO AI. Collects Twilio, FTC and FCC
// data, scores it, applies any shared mark (which overrides the verdict), records history and
// returns everything the screen and the Shortcut need. Twilio is cached 30 days (no paid repeat
// call, spec §3); FCC never throws (timeout → unavailable, spec §4).

export class PhoneInputError extends Error {}

export function displayName(user: string): string {
  if (user === "josh") return "Josh";
  if (user === "christine") return "Christine";
  return user;
}

export type LookupResult = {
  phone: string;
  e164: string;
  display: string;
  verdict: Verdict; // scored verdict key (for colour)
  scoredVerdict: Verdict; // the score's own verdict, ignoring any mark
  verdictLabel: string; // display label — a mark overrides ("Marked spam by Josh")
  score: number;
  reasons: string[];
  callerName: string;
  callerType: string;
  lineType: string;
  carrier: string;
  twilioCached: boolean;
  twilioFetchedAt: string;
  ftc: { count: number; lastSeen: string | null; robocalls: number; topSubject: string };
  fcc: { available: boolean; count: number; lastDate: string | null };
  mark: { label: "spam" | "real"; by: string; note: string } | null;
  source: "desktop" | "shortcut";
  user: string;
  at: string;
};

// Build the result object and the apply-the-mark display, shared by a fresh lookup and a re-open.
function assemble(args: {
  phone: string;
  e164: string;
  display: string;
  twilio: TwilioData;
  twilioCached: boolean;
  twilioFetchedAt: string;
  ftc: FtcSummary;
  fcc: FccResult;
  score: number;
  reasons: string[];
  scoredVerdict: Verdict;
  mark: MarkRow | null;
  source: "desktop" | "shortcut";
  user: string;
  at: string;
}): LookupResult {
  const mark = args.mark;
  const verdict = mark ? verdictForMark(mark.label) : args.scoredVerdict;
  const verdictLabel = mark
    ? `Marked ${mark.label} by ${displayName(mark.user)}`
    : VERDICT_LABEL[args.scoredVerdict];
  return {
    phone: args.phone,
    e164: args.e164,
    display: args.display,
    verdict,
    scoredVerdict: args.scoredVerdict,
    verdictLabel,
    score: args.score,
    reasons: args.reasons,
    callerName: args.twilio.callerName,
    callerType: args.twilio.callerType,
    lineType: args.twilio.lineType,
    carrier: args.twilio.carrier,
    twilioCached: args.twilioCached,
    twilioFetchedAt: args.twilioFetchedAt,
    ftc: { count: args.ftc.count, lastSeen: args.ftc.lastSeen, robocalls: args.ftc.robocalls, topSubject: args.ftc.topSubject },
    fcc: { available: args.fcc.available, count: args.fcc.count, lastDate: args.fcc.lastDate },
    mark: mark ? { label: mark.label, by: displayName(mark.user), note: mark.note } : null,
    source: args.source,
    user: args.user,
    at: args.at,
  };
}

// The JSON snapshot stored on the history row so a re-open re-renders without a new lookup.
function toDetail(r: LookupResult): Record<string, unknown> {
  return {
    display: r.display,
    callerName: r.callerName,
    callerType: r.callerType,
    lineType: r.lineType,
    carrier: r.carrier,
    twilioCached: r.twilioCached,
    twilioFetchedAt: r.twilioFetchedAt,
    ftc: r.ftc,
    fcc: r.fcc,
    source: r.source,
  };
}

export async function runLookup(opts: {
  input: string;
  source: "desktop" | "shortcut";
  user: string; // 'josh' | 'christine'
  refresh?: boolean;
  at?: string;
  fccFetcher?: FccFetcher; // tests inject; defaults to the stub/live FCC path
  fccTimeoutMs?: number;
}): Promise<LookupResult> {
  const norm = normalizePhone(opts.input);
  if (!norm) throw new PhoneInputError("Enter a US phone number.");
  const at = opts.at ?? nowEastern();
  const today = at.slice(0, 10); // Eastern calendar date from the Eastern stamp

  const twilio = await getTwilio(norm.phone, norm.e164, { refresh: opts.refresh, at });
  await ensureFtcData(today, at);
  const ftc = ftcSummaryFor(norm.phone, today);
  const fcc = await fccLookup(norm.phone, today, { fetcher: opts.fccFetcher, timeoutMs: opts.fccTimeoutMs });

  const scored = scorePhone({ twilio, ftc, fcc });
  const mark = getMark(norm.phone);

  const result = assemble({
    phone: norm.phone,
    e164: norm.e164,
    display: norm.display,
    twilio,
    twilioCached: twilio.cached,
    twilioFetchedAt: twilio.fetchedAt,
    ftc,
    fcc,
    score: scored.score,
    reasons: scored.reasons,
    scoredVerdict: scored.verdict,
    mark,
    source: opts.source,
    user: opts.user,
    at,
  });

  // Record history with the scored verdict (a mark overrides on display, not in the stored row).
  recordLookup({
    phone: result.phone,
    verdict: result.scoredVerdict,
    score: result.score,
    reasons: result.reasons,
    detail: toDetail(result),
    source: opts.source,
    user: opts.user,
    createdAt: at,
  });

  return result;
}

// Re-open the most recent stored lookup for a number without a new lookup (history click, or after
// a mark change). The current mark is applied, so a just-marked number shows the mark verdict.
export function reopenLookup(phone: string): LookupResult | null {
  const row = latestLookup(phone);
  if (!row) return null;
  const d = row.detail as {
    display?: string;
    callerName?: string;
    callerType?: string;
    lineType?: string;
    carrier?: string;
    twilioCached?: boolean;
    twilioFetchedAt?: string;
    ftc?: { count: number; lastSeen: string | null; robocalls: number; topSubject: string };
    fcc?: { available: boolean; count: number; lastDate: string | null };
    source?: "desktop" | "shortcut";
  };
  const storedFcc = d.fcc;
  const twilio: TwilioData = {
    callerName: d.callerName ?? "",
    callerType: d.callerType ?? "",
    lineType: d.lineType ?? "",
    carrier: d.carrier ?? "",
  };
  const ftc: FtcSummary = d.ftc ?? { count: 0, robocalls: 0, lastSeen: null, topSubject: "" };
  const fcc: FccResult = storedFcc
    ? { available: storedFcc.available, count: storedFcc.count, lastDate: storedFcc.lastDate, callTypes: [] }
    : { available: true, count: 0, lastDate: null, callTypes: [] };
  const scoredVerdict = verdictFromScore(row.score, getScoringConfig());
  return assemble({
    phone: row.phone,
    e164: `+1${row.phone}`,
    display: d.display ?? row.phone,
    twilio,
    twilioCached: d.twilioCached ?? true,
    twilioFetchedAt: d.twilioFetchedAt ?? row.createdAt,
    ftc,
    fcc,
    score: row.score,
    reasons: row.reasons,
    scoredVerdict,
    mark: getMark(row.phone),
    source: d.source ?? row.source,
    user: row.user,
    at: row.createdAt,
  });
}
