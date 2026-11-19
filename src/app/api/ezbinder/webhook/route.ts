import { NextResponse } from "next/server";
import { nowEastern } from "@/lib/kanban/time";
import { claimEvent, recordBadSignature } from "@/lib/ezbinder/events";
import { verifySignature, applyEvent, noteWebhookAt, type WebhookEvent } from "@/lib/ezbinder/webhook";
import { startEzbSync } from "@/lib/ezbinder/sync";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// EZ Binder webhook receiver, reached through the tunnel (spec §2, handoff §7.2, §2). It verifies
// the HMAC signature, records each event id once and applies the change newest-updated_at-wins.
// Ordinary code, no AI. A bad signature is refused and logged (spec check 1); a repeat delivery
// changes data once (spec check 2).

function claimedId(raw: string, at: string): string {
  try {
    const id = (JSON.parse(raw) as { id?: string }).id;
    if (id) return String(id);
  } catch {
    // unparseable body
  }
  return `bad-${at}`;
}

export async function POST(req: Request) {
  startEzbSync(); // ensure the 90-minute safety-net poll is armed
  const at = nowEastern();
  const raw = await req.text();
  const signature = req.headers.get("x-ezb-signature");

  if (!verifySignature(raw, signature)) {
    recordBadSignature(claimedId(raw, at), at);
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }
  if (!event.id) {
    return NextResponse.json({ ok: false, error: "event id is required" }, { status: 400 });
  }

  // Process each event id once (handoff §7.2). A second delivery is a no-op (spec check 2).
  const firstSeen = claimEvent({
    eventId: event.id,
    kind: "webhook",
    entity: event.type ?? null,
    updatedAt: event.updated_at ?? null,
    at,
  });
  if (!firstSeen) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await applyEvent(event, at);
  if (result.outcome === "stale") {
    getDb().prepare("UPDATE ezb_events SET outcome = 'stale' WHERE event_id = ?").run(event.id);
  }
  noteWebhookAt(at);
  return NextResponse.json({ ok: true, outcome: result.outcome, entity: result.entity });
}
