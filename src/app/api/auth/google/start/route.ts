import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { resolveTarget, startConnect } from "@/lib/feeds/connections";
import { nowEastern } from "@/lib/kanban/time";

export const dynamic = "force-dynamic";

// Start a Google connection (handoff §7.3, spec §1). A plain GET so "Connect"/"Reconnect" is an
// ordinary link: the browser follows a clean chain of redirects (here → Google's consent screen /
// the stub → the callback → Settings) rather than a server-action redirect, which keeps the client
// router state sane across several connects in a row. Requires a signed-in user.
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Redirect on the SAME host the browser used (Host header), so the whole flow stays same-origin
  // and the session cookie is carried to the callback.
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const base = host ? `${proto}://${host}` : url.origin;

  const user = currentUser();
  if (!user) return NextResponse.redirect(new URL("/signin", base));

  const t = resolveTarget(url.searchParams.get("target") || "");
  if (!t) return NextResponse.redirect(new URL("/settings", base));

  const authorizeUrl = startConnect(t, user.username, nowEastern());
  // authorizeUrl is relative for the stub consent screen and absolute for real Google; both resolve
  // correctly against the current origin.
  return NextResponse.redirect(new URL(authorizeUrl, base));
}
