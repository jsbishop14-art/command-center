import { NextResponse } from "next/server";
import { isValidShortcutToken, rateLimitOk } from "@/lib/shortcut";
import { nowEastern } from "@/lib/kanban/time";
import { runLookup, PhoneInputError } from "@/lib/phone/lookup";
import { VERDICT_LABEL } from "@/lib/phone/view";

export const dynamic = "force-dynamic";

// Phone lookup from the iPhone Shortcut (handoff §8.7, roles §7). Accepts the Shortcut token ONLY
// (Bearer header) — not the interactive login, not a Claude/Duet action-layer token. The token
// works on no other route than the phone and note routes (spec §3). A lookup attributed to the
// Shortcut is recorded as source=shortcut, user josh (the iPhone is Josh's; decided & logged in
// CC10-status). No AI; the stub stands in off the Mac mini.

function bearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  const alt = req.headers.get("x-cc-token");
  return alt ? alt.trim() : null;
}

export async function POST(req: Request) {
  if (!isValidShortcutToken(bearer(req))) {
    return NextResponse.json({ ok: false, error: "A valid Shortcut token is required." }, { status: 401 });
  }
  if (!rateLimitOk(Date.now())) {
    return NextResponse.json({ ok: false, error: "Too many requests; try again shortly." }, { status: 429 });
  }

  let body: { phone?: unknown; refresh?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const phone = typeof body.phone === "string" ? body.phone : "";
  const refresh = body.refresh === true;

  try {
    const r = await runLookup({ input: phone, source: "shortcut", user: "josh", refresh, at: nowEastern() });
    // The Shortcut notification shows the verdict, caller name and the top two reasons (handoff §8.7).
    return NextResponse.json({
      ok: true,
      phone: r.phone,
      display: r.display,
      verdict: r.verdict,
      verdictLabel: r.verdictLabel,
      callerName: r.callerName,
      reasons: r.reasons.slice(0, 2),
      summary: `${r.verdictLabel}${r.callerName ? ` — ${r.callerName}` : ""}`,
      score: r.score,
      marked: !!r.mark,
      ftc: r.ftc.count,
      fcc: r.fcc.available ? r.fcc.count : null,
      verdictText: VERDICT_LABEL[r.scoredVerdict],
    });
  } catch (e) {
    if (e instanceof PhoneInputError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    throw e;
  }
}
