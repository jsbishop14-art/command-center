import { livePhone } from "./mode";
import { getSecret } from "../secrets";
import { getTwilioCache, putTwilioCache } from "./store";
import { stubTwilio, type TwilioData } from "./stub";

// Twilio Lookup v2 (handoff §8.3). Cached per number for 30 days: a repeat lookup within 30 days
// reads the cache and makes NO paid call (spec §3); Refresh forces a new call. The stub stands in
// everywhere except the Mac mini (livePhone). No AI. The key never leaves this module.

const CACHE_DAYS = 30;

// Test instrumentation: how many actual (stub or live) Twilio fetches were made. A repeat lookup
// within 30 days must not increment this (spec §3). Reset between tests.
let fetchCount = 0;
export function twilioFetchCount(): number {
  return fetchCount;
}
export function resetTwilioFetchCount(): void {
  fetchCount = 0;
}

type TwilioV2 = {
  caller_name?: { caller_name?: string; caller_type?: string } | null;
  line_type_intelligence?: { type?: string; carrier_name?: string } | null;
};

async function fetchTwilio(phone: string, e164: string): Promise<TwilioData> {
  fetchCount++;
  if (!livePhone()) return stubTwilio(phone);

  // Live path — Mac mini only, never exercised by tests. GET the v2 endpoint with basic auth
  // (handoff §8.3). The SID/token come from the secret store and are never logged or returned.
  const sid = getSecret("twilio_sid");
  const token = getSecret("twilio_token");
  if (!sid || !token) throw new Error("Twilio keys are not set");
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=caller_name,line_type_intelligence`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio lookup failed: ${res.status}`);
  const j = (await res.json()) as TwilioV2;
  return {
    callerName: j.caller_name?.caller_name ?? "",
    callerType: j.caller_name?.caller_type ?? "",
    lineType: j.line_type_intelligence?.type ?? "",
    carrier: j.line_type_intelligence?.carrier_name ?? "",
  };
}

export type TwilioResult = TwilioData & { fetchedAt: string; cached: boolean };

function ageDays(fetchedAt: string, nowIso: string): number {
  return (new Date(nowIso).getTime() - new Date(fetchedAt).getTime()) / (24 * 60 * 60 * 1000);
}

// Twilio data for a number: cached if fresh (< 30 days) unless refresh forces a new paid call.
export async function getTwilio(
  phone: string,
  e164: string,
  opts: { refresh?: boolean; at: string },
): Promise<TwilioResult> {
  const cached = getTwilioCache(phone);
  if (cached && !opts.refresh && ageDays(cached.fetchedAt, opts.at) < CACHE_DAYS) {
    return {
      callerName: cached.callerName,
      callerType: cached.callerType,
      lineType: cached.lineType,
      carrier: cached.carrier,
      fetchedAt: cached.fetchedAt,
      cached: true,
    };
  }
  const data = await fetchTwilio(phone, e164);
  putTwilioCache(phone, data, opts.at);
  return { ...data, fetchedAt: opts.at, cached: false };
}
