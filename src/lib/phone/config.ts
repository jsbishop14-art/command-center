import { getSetting, setSetting } from "../kanban/state";

// The one scoring config (handoff §8.4, spec §3): all points and thresholds live here and are
// editable in Settings for tuning during Josh's testing. No AI. Defaults are the handoff table.
// The stored value is a JSON object in app_settings (key phone_scoring); any missing field falls
// back to the default, so a partial edit is safe and a new field added later is picked up.

export type ScoringConfig = {
  ftcLow: number; // FTC complaints 1–2
  ftcMid: number; // FTC complaints 3–9
  ftcHigh: number; // FTC complaints 10+
  fccLow: number; // FCC complaints 1–2
  fccHigh: number; // FCC complaints 3+
  robocall: number; // any complaint flagged robocall / prerecorded
  nonFixedVoip: number; // line type nonFixedVoip
  fixedVoipOrTollFree: number; // line type fixedVoip or tollFree
  genericName: number; // no caller name, or a generic one
  consumerClean: number; // CONSUMER + personal name + mobile/landline + zero complaints (negative)
  telemarketer: number; // score ≥ this → Likely telemarketer
  unclear: number; // score ≥ this (and < telemarketer) → Unclear; below → Likely real person
};

export const DEFAULT_SCORING: ScoringConfig = {
  ftcLow: 2,
  ftcMid: 3,
  ftcHigh: 4,
  fccLow: 2,
  fccHigh: 3,
  robocall: 1,
  nonFixedVoip: 2,
  fixedVoipOrTollFree: 1,
  genericName: 1,
  consumerClean: -2,
  telemarketer: 4,
  unclear: 2,
};

const KEY = "phone_scoring";

// Each editable field, in display order, with a plain-words label for the Settings form.
export const SCORING_FIELDS: { key: keyof ScoringConfig; label: string }[] = [
  { key: "ftcLow", label: "FTC complaints 1–2" },
  { key: "ftcMid", label: "FTC complaints 3–9" },
  { key: "ftcHigh", label: "FTC complaints 10+" },
  { key: "fccLow", label: "FCC complaints 1–2" },
  { key: "fccHigh", label: "FCC complaints 3+" },
  { key: "robocall", label: "Flagged robocall / prerecorded" },
  { key: "nonFixedVoip", label: "Internet phone (nonFixedVoip)" },
  { key: "fixedVoipOrTollFree", label: "fixedVoip or toll-free" },
  { key: "genericName", label: "No name, or a generic name" },
  { key: "consumerClean", label: "Personal name, clean (bonus)" },
  { key: "telemarketer", label: "Threshold: Likely telemarketer (≥)" },
  { key: "unclear", label: "Threshold: Unclear (≥)" },
];

export function getScoringConfig(): ScoringConfig {
  const raw = getSetting(KEY);
  if (!raw) return { ...DEFAULT_SCORING };
  let parsed: Partial<ScoringConfig> = {};
  try {
    parsed = JSON.parse(raw) as Partial<ScoringConfig>;
  } catch {
    return { ...DEFAULT_SCORING };
  }
  const out = { ...DEFAULT_SCORING };
  for (const f of SCORING_FIELDS) {
    const v = parsed[f.key];
    if (typeof v === "number" && Number.isFinite(v)) out[f.key] = Math.trunc(v);
  }
  return out;
}

export function setScoringConfig(next: Partial<ScoringConfig>): ScoringConfig {
  const merged = { ...getScoringConfig() };
  for (const f of SCORING_FIELDS) {
    const v = next[f.key];
    if (typeof v === "number" && Number.isFinite(v)) merged[f.key] = Math.trunc(v);
  }
  setSetting(KEY, JSON.stringify(merged));
  return merged;
}
