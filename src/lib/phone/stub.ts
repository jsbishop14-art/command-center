import { monthsBetween, monthStart } from "./dates";

// Deterministic stand-ins for Twilio Lookup v2, the FTC Do Not Call API and the FCC open-data API
// (handoff §8.3). The default everywhere except the Mac mini (spec §6; CLAUDE §3), so no build
// session or CI job makes a real outside call. Numbers here are obviously fake (555 exchange,
// 800 toll-free) — no real customer data (CLAUDE §1). No AI.

export type TwilioData = {
  callerName: string;
  callerType: string; // BUSINESS | CONSUMER | ""
  lineType: string; // mobile | landline | fixedVoip | nonFixedVoip | tollFree | ""
  carrier: string;
};

// Seeded Twilio results, chosen to exercise every scoring signal and each verdict band.
const TWILIO: Record<string, TwilioData> = {
  // Heavy robocaller: no name, internet line → scores high with the FTC/FCC counts below.
  "5615550111": { callerName: "", callerType: "", lineType: "nonFixedVoip", carrier: "Bandwidth" },
  // Spammy business on a toll-free line.
  "8005550144": { callerName: "VEHICLE SERVICE DEPT", callerType: "BUSINESS", lineType: "tollFree", carrier: "Toll Free" },
  // Low-complaint business on mobile → Unclear.
  "5615550199": { callerName: "SOLAR PRO LLC", callerType: "BUSINESS", lineType: "mobile", carrier: "Verizon" },
  // Real people (personal name, consumer, clean) → the −2 bonus pushes to Likely real person.
  "5615550170": { callerName: "MARIA GOMEZ", callerType: "CONSUMER", lineType: "mobile", carrier: "T-Mobile" },
  "5615550171": { callerName: "JAMES REYNOLDS", callerType: "CONSUMER", lineType: "landline", carrier: "AT&T" },
  // Legit local business, no complaints.
  "5615550180": { callerName: "BOYNTON PLUMBING", callerType: "BUSINESS", lineType: "landline", carrier: "AT&T" },
  // Generic registered name.
  "5615550160": { callerName: "WIRELESS CALLER", callerType: "", lineType: "mobile", carrier: "US Cellular" },
};

export function stubTwilio(phone: string): TwilioData {
  const seeded = TWILIO[phone];
  if (seeded) return seeded;
  // Any other number: a plain mobile with no registered name (common for cell numbers, handoff
  // §8.6 limits). Deterministic, so the same number always returns the same result.
  return { callerName: "", callerType: "", lineType: "mobile", carrier: "Stub Mobile" };
}

// ---- FTC Do Not Call (monthly aggregates) ------------------------------------------------------

export type FtcMonthAgg = {
  phone: string;
  complaints: number;
  robocalls: number;
  lastSeen: string; // YYYY-MM-DD within the month
  topSubject: string;
};

// Each seeded number's complaints per month, keyed by how many months back the month is from the
// caller's "today" (0 = current month, 11 = oldest in the 12-month window). This lets the stub
// produce stable 12-month totals that land in each FTC tier regardless of the calendar date.
const FTC: { phone: string; robocall: boolean; subject: string; perMonth: (monthsBack: number) => number }[] = [
  // 2/month × 12 = 24 → 10+ tier; flagged robocall.
  { phone: "5615550111", robocall: true, subject: "Reducing credit card debt", perMonth: (b) => (b <= 11 ? 2 : 0) },
  // 1/month × first 6 months = 6 → 3–9 tier; flagged robocall.
  { phone: "8005550144", robocall: true, subject: "Auto warranty", perMonth: (b) => (b <= 5 ? 1 : 0) },
  // 1 complaint this month only → 1–2 tier.
  { phone: "5615550199", robocall: false, subject: "Solar panels", perMonth: (b) => (b === 0 ? 1 : 0) },
];

// The FTC monthly aggregates the ingest would read for one month, given the caller's Eastern
// today. Returns one row per seeded number that had any complaints that month.
export function stubFtcMonth(monthYm01: string, todayYmd: string): FtcMonthAgg[] {
  const back = monthsBetween(monthStart(todayYmd), monthYm01);
  if (back < 0) return []; // future month
  const out: FtcMonthAgg[] = [];
  for (const n of FTC) {
    const complaints = n.perMonth(back);
    if (complaints <= 0) continue;
    out.push({
      phone: n.phone,
      complaints,
      robocalls: n.robocall ? complaints : 0,
      lastSeen: `${monthYm01.slice(0, 7)}-15`,
      topSubject: n.subject,
    });
  }
  return out;
}

// ---- FCC unwanted-call complaints (live query by number) ---------------------------------------

export type FccData = {
  count: number;
  lastDate: string | null; // YYYY-MM-DD
  callTypes: string[];
};

const FCC: Record<string, FccData> = {
  "5615550111": { count: 5, lastDate: null, callTypes: ["Prerecorded Voice", "Robocalls"] },
  "8005550144": { count: 2, lastDate: null, callTypes: ["Telemarketing"] },
};

// The FCC result for a number. todayYmd fills a recent most-recent-complaint date for seeded
// numbers (so the card shows one) without hardcoding a calendar date.
export function stubFcc(phone: string, todayYmd: string): FccData {
  const seeded = FCC[phone];
  if (!seeded) return { count: 0, lastDate: null, callTypes: [] };
  return { ...seeded, lastDate: `${todayYmd.slice(0, 7)}-05` };
}
