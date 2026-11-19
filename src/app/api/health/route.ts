import { NextResponse } from "next/server";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

// "The app answers" (handoff 7.4 step 6). Also reports the known logins so the smoke check knows
// who to try. No secrets, no session required.
export function GET() {
  try {
    const users = listUsers().map((u) => u.username);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unavailable" },
      { status: 500 },
    );
  }
}
