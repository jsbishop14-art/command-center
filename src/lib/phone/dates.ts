// Small month helpers for the FTC rolling-12-month window (handoff §8.3, §8.5). Dates are plain
// YYYY-MM-DD / YYYY-MM-01 strings in the Eastern calendar (the caller passes an Eastern "today");
// no timezone math here, so a month is just year*12+month arithmetic. No AI.

// The first of the month for a YYYY-MM-DD (or any YYYY-MM-… prefix).
export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

// Add n months (may be negative) to a YYYY-MM-01, returning YYYY-MM-01.
export function addMonths(ym01: string, n: number): string {
  const y = Number(ym01.slice(0, 4));
  const m = Number(ym01.slice(5, 7)); // 1–12
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01`;
}

// Whole months a - b (both YYYY-MM-…); positive when a is later than b.
export function monthsBetween(a: string, b: string): number {
  const ay = Number(a.slice(0, 4));
  const am = Number(a.slice(5, 7));
  const by = Number(b.slice(0, 4));
  const bm = Number(b.slice(5, 7));
  return ay * 12 + am - (by * 12 + bm);
}

// The earliest month still inside the rolling 12-month window ending at "today" (inclusive of the
// current month): current month minus 11.
export function windowStart(todayYmd: string): string {
  return addMonths(monthStart(todayYmd), -11);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A short "Oct 28" from a YYYY-MM-DD (handoff §8.4 reason example). Parsed from parts, no timezone
// math. Returns "" for an empty/unparseable date.
export function formatShortDate(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  if (m < 1 || m > 12) return "";
  return `${MONTHS[m - 1]} ${d}`;
}
