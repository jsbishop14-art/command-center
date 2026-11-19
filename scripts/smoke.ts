#!/usr/bin/env tsx
// Smoke check (handoff 7.4 step 6). Lives in the repo so each build keeps it current. For CC1 it
// verifies the app answers and both logins reach Home. The kanban check is added in CC2 and the
// touch-screen reconnect check in CC9. Exit code is 0 only when every check passes, so the updater
// can read a real pass/fail.
const BASE = process.env.CC_SMOKE_URL || `http://127.0.0.1:${process.env.CC_SMOKE_PORT || 3000}`;

const LOGINS = [
  { username: "josh", password: process.env.CC_JOSH_PASSWORD || "josh-dev-password" },
  { username: "christine", password: process.env.CC_CHRISTINE_PASSWORD || "christine-dev-password" },
];

type Check = { name: string; ok: boolean; detail: string };

async function run(): Promise<Check[]> {
  const checks: Check[] = [];

  // The app answers.
  try {
    const res = await fetch(`${BASE}/api/health`);
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
    checks.push({
      name: "app answers",
      ok: res.ok && !!body.ok,
      detail: `GET /api/health -> ${res.status}`,
    });
  } catch (e) {
    checks.push({ name: "app answers", ok: false, detail: String(e) });
    return checks; // nothing else can pass if the app is down
  }

  // Both logins reach Home.
  for (const login of LOGINS) {
    try {
      const signin = await fetch(`${BASE}/api/auth/signin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(login),
        redirect: "manual",
      });
      const cookie = signin.headers.get("set-cookie") || "";
      if (!signin.ok || !cookie.includes("cc_session")) {
        checks.push({
          name: `${login.username} reaches Home`,
          ok: false,
          detail: `signin -> ${signin.status}, cookie ${cookie ? "set" : "missing"}`,
        });
        continue;
      }
      const home = await fetch(`${BASE}/home`, {
        headers: { cookie: cookie.split(";")[0] },
        redirect: "manual",
      });
      const text = await home.text();
      checks.push({
        name: `${login.username} reaches Home`,
        ok: home.status === 200 && text.includes("Home"),
        detail: `GET /home -> ${home.status}`,
      });
    } catch (e) {
      checks.push({ name: `${login.username} reaches Home`, ok: false, detail: String(e) });
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
