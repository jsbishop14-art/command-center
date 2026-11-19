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
  // Build the callback URL on the SAME origin as this request, so the flow works on whatever port
  // the app is served from (the configured redirect URI host may differ in dev/CI).
  const back = new URL("/api/auth/google/callback", req.url);
  back.searchParams.set("code", `stub-code-${state}`);
  back.searchParams.set("state", state);
  return NextResponse.redirect(back);
}
