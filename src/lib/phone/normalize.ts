// Turn any input — a typed number, a pasted number in any format, or text containing a number
// (handoff §8.2, §8.6) — into a US (NANP) 10-digit number, or null if none is found. Non-US
// numbers are out of scope (spec §5): only a valid NANP number (area and exchange codes starting
// 2–9) is accepted. No AI.

export type NormalizedPhone = {
  phone: string; // 10 digits, e.g. 5615550123
  e164: string; // +15615550123
  display: string; // (561) 555-0123
};

// A phone-shaped token anywhere in the text: optional +1 / 1, optional punctuation, 3-3-4 digits.
const CANDIDATE =
  /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?([2-9]\d{2})[\s.\-]?(\d{4})/;

export function normalizePhone(input: string | null | undefined): NormalizedPhone | null {
  if (!input) return null;

  // First try: a phone-shaped token in the text (handles "Call me at (561) 555-0123 tomorrow").
  const m = CANDIDATE.exec(input);
  let ten: string | null = null;
  if (m) {
    ten = m[1] + m[2] + m[3];
  } else {
    // Fallback: strip to digits. Accept a bare 10, or 11 with a leading country code 1.
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) ten = digits;
    else if (digits.length === 11 && digits[0] === "1") ten = digits.slice(1);
  }
  if (!ten || ten.length !== 10) return null;

  // NANP validity: area and exchange codes must start 2–9 (rejects e.g. 0/1 leads and many
  // non-US shapes that slipped through the digit fallback).
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;

  return {
    phone: ten,
    e164: `+1${ten}`,
    display: `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`,
  };
}

// Format a stored 10-digit number for display. Used by history rows and the result card.
export function formatPhone(ten: string): string {
  if (!/^\d{10}$/.test(ten)) return ten;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

// True when the input contains a recognizable US number (used by Quick add to offer "Look up
// number", handoff §8.2).
export function looksLikePhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}
