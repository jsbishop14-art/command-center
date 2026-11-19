import { getDb } from "@/lib/db";

// Idempotent record of every EZ Binder delivery — webhooks and /changes entries (handoff §7.2
// "process each event id once"; spec checks 1 and 2). The event id is the primary key, so a second
// delivery of the same id is seen as a duplicate and changes nothing. A bad-signature webhook is
// recorded here too, with outcome 'bad_signature', so a refusal is logged (spec check 1). No AI.

export type EventOutcome = "processed" | "duplicate" | "stale" | "bad_signature";

// Try to claim an event id for processing. Returns true when this is the first time the id is seen
// (the caller should apply it); false when it was already recorded (a duplicate — change nothing).
// The insert and the check are one statement, so two concurrent deliveries cannot both win.
export function claimEvent(args: {
  eventId: string;
  kind: string;
  entity: string | null;
  updatedAt: string | null;
  at: string;
}): boolean {
  const info = getDb()
    .prepare(
      `INSERT INTO ezb_events (event_id, kind, entity, updated_at, received_at, outcome)
       VALUES (?, ?, ?, ?, ?, 'processed')
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(args.eventId, args.kind, args.entity, args.updatedAt, args.at);
  if (info.changes === 1) return true;
  // Already present: record a duplicate delivery for the audit, keeping the original row.
  recordDuplicate(args.eventId, args.at);
  return false;
}

// A duplicate delivery does not get its own primary-key row (the id is taken); it is counted on the
// existing row via a received_at bump so the audit shows the last time it was re-delivered.
function recordDuplicate(eventId: string, at: string): void {
  getDb().prepare("UPDATE ezb_events SET received_at = ? WHERE event_id = ?").run(at, eventId);
}

// Log a refused bad-signature webhook (spec check 1). Uses INSERT OR IGNORE so a forged id that
// collides with a real one never overwrites the real row.
export function recordBadSignature(eventId: string, at: string): void {
  getDb()
    .prepare(
      `INSERT INTO ezb_events (event_id, kind, entity, updated_at, received_at, outcome)
       VALUES (?, 'webhook', NULL, NULL, ?, 'bad_signature')
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .run(eventId, at);
}

export function eventOutcome(eventId: string): EventOutcome | null {
  const r = getDb().prepare("SELECT outcome FROM ezb_events WHERE event_id = ?").get(eventId) as
    | { outcome: EventOutcome }
    | undefined;
  return r?.outcome ?? null;
}

export function eventSeen(eventId: string): boolean {
  return eventOutcome(eventId) !== null;
}
