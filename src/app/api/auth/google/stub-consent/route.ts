import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The stub Google consent screen (CI, build sessions, local dev). On the Mac mini with a real
// Google client the connect flow goes to Google's own consent screen instead and never reaches
// here (authorizeUrl returns the real URL). This consents immediately and redirects back to the
// callback with a stub authorization code, so the connect flow is clickable end-to-end without any
// real Google call (spec §3). It can grant nothing on its own — the callback still requires a
// matching one-time state row that only a real "Connect" click creates.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  // Build the callback URL on the SAME host the browser used (from the Host header, not req.url,
  // which Next may normalise to localhost) so the flow stays same-origin and the session cookie is
  // sent to the callback. Works on whatever host/port the app is served from.
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const base = host ? `${proto}://${host}` : url.origin;
  const back = new URL("/api/auth/google/callback", base);
  back.searchParams.set("code", `stub-code-${state}`);
  back.searchParams.set("state", state);
  return NextResponse.redirect(back);
}
