// Timestamps with the America/New_York offset (handoff §4.2: "Timestamp with time zone
// (America/New_York)"). Produces an ISO 8601 string like 2026-11-09T13:20:00-05:00, DST-aware.

export function nowEastern(d: Date = new Date()): string {
  return easternStamp(d);
}

export function easternStamp(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  // Offset = (wall-clock interpreted as UTC) - (actual UTC instant).
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(hour),
    Number(p.minute),
    Number(p.second),
  );
  const offsetMin = Math.round((asUTC - d.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}${sign}${oh}:${om}`;
}

// Days between two ISO timestamps (a - b), as a floating-point number of days.
export function daysBetween(aIso: string, bIso: string): number {
  return (new Date(aIso).getTime() - new Date(bIso).getTime()) / (24 * 60 * 60 * 1000);
}
