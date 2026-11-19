import type { Verdict } from "./scoring";

// Display helpers for the phone screen (handoff §8.6). Pure, client-safe — no database or config
// imports, so client components can use them. No AI.

export const VERDICT_LABEL: Record<Verdict, string> = {
  telemarketer: "Likely telemarketer",
  unclear: "Unclear",
  real: "Likely real person",
};

// Header / dot colours from the mockup (red / amber / green).
export const VERDICT_COLOR: Record<Verdict, string> = {
  telemarketer: "#B91C1C",
  unclear: "#B45309",
  real: "#15803D",
};

// A plain-words line-type label (handoff §8.4 reason wording, §8.6).
export function lineLabel(lineType: string): string {
  switch (lineType) {
    case "mobile":
      return "Mobile";
    case "landline":
      return "Landline";
    case "fixedVoip":
    case "nonFixedVoip":
    case "voip":
      return "Internet phone (VoIP)";
    case "tollFree":
      return "Toll-free";
    case "":
      return "Unknown";
    default:
      return lineType;
  }
}

// A mark 'spam' reads as telemarketer (red); 'real' reads as a real person (green).
export function verdictForMark(label: "spam" | "real"): Verdict {
  return label === "spam" ? "telemarketer" : "real";
}
