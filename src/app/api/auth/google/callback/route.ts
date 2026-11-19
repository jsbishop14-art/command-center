import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { finishConnect } from "@/lib/feeds/connections";
import { targetKey } from "@/lib/feeds/google";
import { nowEastern } from "@/lib/kanban/time";

export const dynamic = "force-dynamic";

// OAuth callback (handoff §7.3, spec §1). Google (or the stub consent screen) redirects here with a
// code and the one-time state. It validates the state, exchanges the code for tokens, stores them
// and marks the target connected, then returns to Settings. No token or secret is ever logged.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const settings = new URL("/settings", req.url);

  // The callback is a top-level navigation that carries the session cookie; require a signed-in
  // user so the endpoint cannot be driven by an unauthenticated request.
  if (!currentUser()) return NextResponse.redirect(new URL("/signin", req.url));

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (error || !code || !state) {
    settings.searchParams.set("google_error", error || "sign-in was cancelled");
    return NextResponse.redirect(settings);
  }

  const result = await finishConnect(state, code, nowEastern());
  if (!result.ok) {
    settings.searchParams.set("google_error", result.error || "sign-in failed");
  } else if (result.target) {
    settings.searchParams.set("connected", targetKey(result.target));
  }
  return NextResponse.redirect(settings);
}
