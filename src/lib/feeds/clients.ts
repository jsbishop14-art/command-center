import { liveFeeds } from "./mode";

// Clients with an active GC job (handoff §2 Awaiting reply: "1 day if the recipient is a client
// with an active job"). The real source is EZ Binder GET /customers?has_active_job=true and
// /customers/lookup, which arrives in CC6; until then the 1-day rule uses this stub list (spec §2).
// Ordinary code, no AI. The live path returns nothing until CC6 wires EZ Binder, so the 1-day rule
// simply does not fire early anywhere a build session or CI runs (handoff §7.5).

export type ActiveClient = { email: string; name: string };

const STUB: ActiveClient[] = [
  { email: "dana@riverwoodbuild.com", name: "Riverwood Build" },
  { email: "mgarcia@bntconstruction.com", name: "BNT Construction" },
];

export function activeJobClients(): ActiveClient[] {
  if (liveFeeds()) return []; // EZ Binder is wired in CC6; no real customer call here.
  return STUB;
}

// Match a recipient email to an active-job client, case-insensitively. Returns null when the
// recipient is not a client with an active job (the 2-day rule then applies).
export function activeClientFor(email: string): ActiveClient | null {
  const e = email.trim().toLowerCase();
  return activeJobClients().find((c) => c.email.toLowerCase() === e) ?? null;
}
