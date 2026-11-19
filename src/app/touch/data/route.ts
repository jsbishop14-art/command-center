import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { touchView } from "@/lib/touch/view";
import { getTouchIdleMinutes } from "@/lib/touch/settings";

export const dynamic = "force-dynamic";

// The touch screen polls this for fresh data so it can jump to screen 2 the moment a new build alert
// appears (handoff §6; spec §4 check 2). Same local reads as the page — no outside call, no AI.
// Signed-in only, like the page itself.
export async function GET() {
  if (!currentUser()) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const view = touchView(new Date(), getTouchIdleMinutes());
  return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
}
