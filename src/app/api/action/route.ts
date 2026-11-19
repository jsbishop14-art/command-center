import { NextResponse } from "next/server";
import { resolveToken } from "@/lib/kanban/tokens";
import { startReconciler } from "@/lib/kanban/reconciler";
import {
  addCard,
  updateCard,
  moveCard,
  appendNote,
  readCard,
  revertChange,
  ActionError,
} from "@/lib/kanban/actions-layer";
import { listCards } from "@/lib/kanban/store";
import { suggestNote } from "@/lib/kanban/pending";
import { updateDeal, readDeal, revertDeal } from "@/lib/deals/actions";
import { nowEastern } from "@/lib/kanban/time";
import type { TokenWriter } from "@/lib/kanban/types";

export const dynamic = "force-dynamic";

// The action layer endpoint (handoff §4.8). Reached through the tunnel with a per-writer token:
// Claude and Duet each have their own. Duet's token is refused when the Duet switch is off. The
// commands are the card commands, note suggest, reads, and the deal commands (update_deal,
// read_deal, revert) — deals always go through the action layer (handoff §4.8, spec §3). Schedule
// proposals arrive in CC6.

function bearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  const alt = req.headers.get("x-cc-token");
  return alt ? alt.trim() : null;
}

// A run id for the log, by writer (handoff §4.6). The token path is Duet, or Claude in a chat from
// another computer; Sync runs server-side in CC7.
function runId(writer: TokenWriter, at: string): string {
  const stamp = at.replace(/[-:T]/g, "").slice(0, 12);
  return writer === "duet" ? `duet-${stamp}` : `chat-${stamp}`;
}

export async function POST(req: Request) {
  startReconciler();
  const resolved = resolveToken(bearer(req));
  if ("denied" in resolved) {
    const status = resolved.denied === "duet_off" ? 403 : 401;
    const msg =
      resolved.denied === "duet_off"
        ? "Duet is switched off."
        : resolved.denied === "revoked"
          ? "This token has been revoked."
          : "A valid action-layer token is required.";
    return NextResponse.json({ ok: false, error: msg, denied: resolved.denied }, { status });
  }
  const writer = resolved.writer;

  let body: { command?: string; [k: string]: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }
  const command = String(body.command || "");
  const at = nowEastern();
  const run = runId(writer, at);

  try {
    switch (command) {
      case "add_card": {
        const card = addCard(writer, body.card as never, { at, run });
        return NextResponse.json({ ok: true, card });
      }
      case "update_card": {
        const card = updateCard(writer, String(body.id), body.changes as never, { at, run });
        return NextResponse.json({ ok: true, card });
      }
      case "move_card": {
        const card = moveCard(writer, String(body.id), String(body.stage), body.order as number | undefined, { at, run });
        return NextResponse.json({ ok: true, card });
      }
      case "append_note": {
        const card = appendNote(writer, String(body.id), String(body.text), { at, run });
        return NextResponse.json({ ok: true, card });
      }
      case "suggest_note": {
        const note = suggestNote(
          String(body.id),
          { project: body.project as string | undefined, boards: body.boards as never },
          writer,
          at,
          run,
        );
        return NextResponse.json({ ok: true, note });
      }
      case "read_card": {
        return NextResponse.json({ ok: true, card: readCard(String(body.id)) });
      }
      case "list_cards": {
        return NextResponse.json({ ok: true, cards: listCards() });
      }
      case "revert": {
        const result = revertChange(writer, String(body.log_id), { force: body.force === true, at });
        return NextResponse.json({ ok: true, result });
      }
      case "update_deal": {
        const deal = updateDeal(writer, Number(body.id), body.changes as never, { at, run });
        return NextResponse.json({ ok: true, deal });
      }
      case "read_deal": {
        return NextResponse.json({ ok: true, deal: readDeal(Number(body.id)) });
      }
      case "revert_deal": {
        const result = revertDeal(writer, Number(body.change_id), { force: body.force === true, at });
        return NextResponse.json({ ok: true, result });
      }
      default:
        return NextResponse.json({ ok: false, error: `unknown command: ${command}` }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ActionError) {
      const status = e.code === "limit" ? 403 : e.code === "not_found" ? 404 : e.code === "duplicate" ? 409 : 400;
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
