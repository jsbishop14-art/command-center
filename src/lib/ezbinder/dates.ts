// Plain calendar-date math on YYYY-MM-DD strings (handoff §2 GC schedule, §2.2 slip rule). No time
// zone and no DST: a schedule date is a wall date. Done on strings so there is no UTC drift. No AI.

// Parse YYYY-MM-DD into a UTC-noon Date (noon avoids any offset rolling the day over).
function parse(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Add (or subtract) whole calendar days to a YYYY-MM-DD date.
export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

// Whole calendar days from `a` to `b` (b - a). Positive when b is later.
export function daysFrom(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

// Is `date` a Saturday or Sunday?
export function isWeekend(date: string): boolean {
  const g = parse(date).getUTCDay();
  return g === 0 || g === 6;
}

// The next `count` weekday dates starting from `from` (inclusive if `from` is a weekday). Used for
// the schedule grid columns — the mockup shows ten weekday columns across the next two weeks.
export function weekdays(from: string, count: number): string[] {
  const out: string[] = [];
  let cur = from;
  while (out.length < count) {
    if (!isWeekend(cur)) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
