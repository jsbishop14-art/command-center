import { NextResponse } from "next/server";
import { isValidShortcutToken, rateLimitOk } from "@/lib/shortcut";
import { createPendingNote } from "@/lib/kanban/pending";
import { startReconciler } from "@/lib/kanban/reconciler";
import { nowEastern } from "@/lib/kanban/time";

export const dynamic = "force-dynamic";

// Note intake from the iPhone Shortcut (handoff §4.4, §8.7, spec §1). The note lands in the kanban
// pending/ folder and shows in the Home Inbox; it becomes a card only when Josh confirms. This
// route accepts the Shortcut token ONLY (Bearer header) — not the interactive login, not a
// Claude/Duet action-layer token. The Shortcut token works on no other route (spec check 2).

function bearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  const alt = req.headers.get("x-cc-token");
  return alt ? alt.trim() : null;
}

export async function POST(req: Request) {
  startReconciler();

  if (!isValidShortcutToken(bearer(req))) {
    return NextResponse.json({ ok: false, error: "A valid Shortcut token is required." }, { status: 401 });
  }
  if (!rateLimitOk(Date.now())) {
    return NextResponse.json({ ok: false, error: "Too many requests; try again shortly." }, { status: 429 });
  }

  let body: { text?: unknown; source?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "A note needs some text." }, { status: 400 });
  }

  // The Shortcut's source ref, if it sent one, is kept for dedup/traceability; via is always
  // shortcut for this route (handoff §4.4). No AI; nothing becomes a card here.
  const sourceRef = typeof body.source === "string" && body.source ? body.source : null;
  const note = createPendingNote({ via: "shortcut", text, source_ref: sourceRef, at: nowEastern() });
  return NextResponse.json({ ok: true, id: note.id });
}
