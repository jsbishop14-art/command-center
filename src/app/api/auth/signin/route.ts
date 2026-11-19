import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Sign-in as a route handler so the UI and the smoke check share one auth path. On success it sets
// the session cookie (handled inside signIn) and returns ok; on failure it returns 401.
export async function POST(req: Request) {
  let username = "";
  let password = "";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
    username = String(body.username || "");
    password = String(body.password || "");
  } else {
    const form = await req.formData();
    username = String(form.get("username") || "");
    password = String(form.get("password") || "");
  }
  username = username.trim().toLowerCase();

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Enter your username and password." }, { status: 400 });
  }
  const user = signIn(username, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "That username or password is not right." },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, redirect: "/home" });
}
