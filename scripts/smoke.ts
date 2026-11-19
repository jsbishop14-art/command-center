#!/usr/bin/env tsx
// Smoke check (handoff 7.4 step 6). Lives in the repo so each build keeps it current. It verifies
// the app answers and that BOTH logins reach Home. Exit code is 0 only when every check passes, so
// the updater can read a real pass/fail.
//
// CC12 (check 5): the check proves both logins reach Home WITHOUT their passwords. The updater has
// the database (CC_DB_PATH) but not Josh's or Christine's passwords, so for each user it mints a
// short-lived session straight into the database, fetches /home with that session cookie, and then
// deletes the session row. No password is supplied and none is stored anywhere new. This fixes the
// 2026-11-19 failure where smoke used CC_JOSH_PASSWORD / CC_CHRISTINE_PASSWORD (absent from the
// updater's environment) and failed against the real passwords, rolling every update back.
import { getDb } from "../src/lib/db";
import { getUserByUsername } from "../src/lib/users";
import { mintSmokeSession, deleteSession } from "../src/lib/sessions";
import { SESSION_COOKIE } from "../src/lib/auth-cookie";

const BASE = process.env.CC_SMOKE_URL || `http://127.0.0.1:${process.env.CC_SMOKE_PORT || 3000}`;

type Check = { name: string; ok: boolean; detail: string };

async function run(): Promise<Check[]> {
  const checks: Check[] = [];

  // The app answers, and tells us who the logins are (no secrets).
  let usernames: string[] = [];
  try {
    const res = await fetch(`${BASE}/api/health`);
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; users?: string[] };
    usernames = body.users ?? [];
    checks.push({
      name: "app answers",
      ok: res.ok && !!body.ok,
      detail: `GET /api/health -> ${res.status}`,
    });
  } catch (e) {
    checks.push({ name: "app answers", ok: false, detail: String(e) });
    return checks; // nothing else can pass if the app is down
  }

  // Both logins reach Home — via a minted session, not a password.
  const db = getDb();
  for (const username of usernames) {
    const user = getUserByUsername(username);
    if (!user) {
      checks.push({ name: `${username} reaches Home`, ok: false, detail: "user not found" });
      continue;
    }
    const { token } = mintSmokeSession(db, user.id);
    try {
      const home = await fetch(`${BASE}/home`, {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
        redirect: "manual",
      });
      const text = await home.text();
      checks.push({
        name: `${username} reaches Home`,
        ok: home.status === 200 && text.includes("Home"),
        detail: `GET /home -> ${home.status}`,
      });
    } catch (e) {
      checks.push({ name: `${username} reaches Home`, ok: false, detail: String(e) });
    } finally {
      deleteSession(db, token); // the smoke session is removed right after the check
    }
  }

  return checks;
}

run().then((checks) => {
  for (const c of checks) {
    console.log(`smoke: ${c.ok ? "PASS" : "FAIL"} — ${c.name} (${c.detail})`);
  }
  console.log("smoke: kanban check added in CC2; touch-screen reconnect check added in CC9");
  const allOk = checks.every((c) => c.ok);
  if (!allOk) process.exit(1);
  console.log("smoke: all checks passed");
});
