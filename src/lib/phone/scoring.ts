import { formatShortDate } from "./dates";
import { getScoringConfig, type ScoringConfig } from "./config";
import type { TwilioData } from "./stub";
import type { FtcSummary } from "./store";
import type { FccResult } from "./fcc";

// Scoring (handoff §8.4). Pure function of the collected data and the config — NO AI, no I/O. A
// mark, if present, overrides the verdict (handled in lookup.ts); this module only computes the
// scored verdict and the plain-words reasons.

export type Verdict = "telemarketer" | "unclear" | "real";

export type ScoreResult = { score: number; verdict: Verdict; reasons: string[] };

// US state names count as "generic" per handoff §8.4 ("a city or state"); cities are too open to
// enumerate, so a bare state name is the covered case.
const GENERIC = new Set([
  "WIRELESS CALLER",
  "WIRELESS",
  "UNKNOWN",
  "UNKNOWN CALLER",
  "UNKNOWN NAME",
  "UNAVAILABLE",
  "NAME UNAVAILABLE",
  "TOLL FREE",
  "TOLLFREE",
  "PRIVATE CALLER",
  "NO NAME",
]);
const STATES = new Set([
  "ALABAMA", "ALASKA", "ARIZONA", "ARKANSAS", "CALIFORNIA", "COLORADO", "CONNECTICUT", "DELAWARE",
  "FLORIDA", "GEORGIA", "HAWAII", "IDAHO", "ILLINOIS", "INDIANA", "IOWA", "KANSAS", "KENTUCKY",
  "LOUISIANA", "MAINE", "MARYLAND", "MASSACHUSETTS", "MICHIGAN", "MINNESOTA", "MISSISSIPPI",
  "MISSOURI", "MONTANA", "NEBRASKA", "NEVADA", "NEW HAMPSHIRE", "NEW JERSEY", "NEW MEXICO",
  "NEW YORK", "NORTH CAROLINA", "NORTH DAKOTA", "OHIO", "OKLAHOMA", "OREGON", "PENNSYLVANIA",
  "RHODE ISLAND", "SOUTH CAROLINA", "SOUTH DAKOTA", "TENNESSEE", "TEXAS", "UTAH", "VERMONT",
  "VIRGINIA", "WASHINGTON", "WEST VIRGINIA", "WISCONSIN", "WYOMING",
]);

export function hasRegisteredName(callerName: string): boolean {
  const n = callerName.trim().toUpperCase();
  if (!n) return false;
  if (GENERIC.has(n)) return false;
  if (STATES.has(n)) return false;
  return true;
}

function ftcPoints(count: number, c: ScoringConfig): number {
  if (count >= 10) return c.ftcHigh;
  if (count >= 3) return c.ftcMid;
  if (count >= 1) return c.ftcLow;
  return 0;
}

function fccPoints(count: number, c: ScoringConfig): number {
  if (count >= 3) return c.fccHigh;
  if (count >= 1) return c.fccLow;
  return 0;
}

export function verdictFromScore(score: number, c: ScoringConfig): Verdict {
  if (score >= c.telemarketer) return "telemarketer";
  if (score >= c.unclear) return "unclear";
  return "real";
}

export function scorePhone(input: {
  twilio: TwilioData;
  ftc: FtcSummary;
  fcc: FccResult;
  config?: ScoringConfig;
}): ScoreResult {
  const c = input.config ?? getScoringConfig();
  const { twilio, ftc, fcc } = input;
  const reasons: string[] = [];
  let score = 0;

  // FTC complaints (last 12 months).
  if (ftc.count > 0) {
    score += ftcPoints(ftc.count, c);
    const when = formatShortDate(ftc.lastSeen);
    reasons.push(
      `${ftc.count} FTC complaint${ftc.count === 1 ? "" : "s"} in the last 12 months` +
        (when ? ` (most recent ${when})` : ""),
    );
  }

  // FCC complaints (last 12 months), or a note if the FCC data could not be reached.
  if (!fcc.available) {
    reasons.push("FCC data unavailable");
  } else if (fcc.count > 0) {
    score += fccPoints(fcc.count, c);
    const when = formatShortDate(fcc.lastDate ?? "");
    reasons.push(
      `${fcc.count} FCC complaint${fcc.count === 1 ? "" : "s"} in the last 12 months` +
        (when ? ` (most recent ${when})` : ""),
    );
  }

  // Robocall / prerecorded flag on any complaint.
  const robocallFlag =
    ftc.robocalls > 0 || fcc.callTypes.some((t) => /robo|prerecord/i.test(t));
  if (robocallFlag) {
    score += c.robocall;
    reasons.push("Flagged as a robocall or prerecorded message");
  }

  // Line type.
  const line = twilio.lineType;
  if (line === "nonFixedVoip") {
    score += c.nonFixedVoip;
    reasons.push("Internet phone line (VoIP)");
  } else if (line === "fixedVoip") {
    score += c.fixedVoipOrTollFree;
    reasons.push("Internet phone line (VoIP)");
  } else if (line === "tollFree") {
    score += c.fixedVoipOrTollFree;
    reasons.push("Toll-free number");
  }

  // Name.
  const named = hasRegisteredName(twilio.callerName);
  if (!named) {
    score += c.genericName;
    reasons.push(twilio.callerName.trim() ? `Generic caller name ("${twilio.callerName.trim()}")` : "No registered name");
  }

  // Clean personal number bonus.
  const personalClean =
    twilio.callerType === "CONSUMER" &&
    named &&
    (line === "mobile" || line === "landline") &&
    ftc.count === 0 &&
    (!fcc.available || fcc.count === 0);
  if (personalClean) {
    score += c.consumerClean;
    reasons.push("Registered to a person, with no complaints");
  }

  return { score, verdict: verdictFromScore(score, c), reasons };
}
