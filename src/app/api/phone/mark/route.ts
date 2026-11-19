import { NextResponse } from "next/server";
import { isValidShortcutToken, rateLimitOk } from "@/lib/shortcut";
import { nowEastern } from "@/lib/kanban/time";
import { normalizePhone } from "@/lib/phone/normalize";
import { setMark, removeMark } from "@/lib/phone/store";

export const dynamic = "force-dynamic";

// Mark spam / real and remove a mark from the iPhone Shortcut (handoff §8.7, roles §7). Accepts the
// Shortcut token ONLY (Bearer header). The mark is shared with the desktop and attributed to josh
// (the iPhone is Josh's; decided & logged in CC10-status). No AI.

function bearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  const alt = req.headers.get("x-cc-token");
  return alt ? alt.trim() : null;
}

function guard(req: Request): NextResponse | null {
  if (!isValidShortcutToken(bearer(req))) {
    return NextResponse.json({ ok: false, error: "A valid Shortcut token is required." }, { status: 401 });
  }
  if (!rateLimitOk(Date.now())) {
    return NextResponse.json({ ok: false, error: "Too many requests; try again shortly." }, { status: 429 });
  }
  return null;
}

async function phoneFrom(req: Request): Promise<{ phone?: string; label?: string; note?: string } | null> {
  try {
    return (await req.json()) as { phone?: string; label?: string; note?: string };
  } catch {
    return null;
  }
}

export async function PUT(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const body = await phoneFrom(req);
  if (!body) return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  const norm = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  const label = body.label;
  if (!norm) return NextResponse.json({ ok: false, error: "Enter a US phone number." }, { status: 400 });
  if (label !== "spam" && label !== "real") {
    return NextResponse.json({ ok: false, error: "label must be 'spam' or 'real'." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  setMark(norm.phone, label, "josh", note, nowEastern());
  return NextResponse.json({ ok: true, phone: norm.phone, label });
}

export async function DELETE(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const body = await phoneFrom(req);
  if (!body) return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  const norm = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!norm) return NextResponse.json({ ok: false, error: "Enter a US phone number." }, { status: 400 });
  removeMark(norm.phone);
  return NextResponse.json({ ok: true, phone: norm.phone });
}
