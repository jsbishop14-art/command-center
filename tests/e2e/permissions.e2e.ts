import { test, expect, request } from "@playwright/test";

// Route-level permission map for CC1 (complements tests/unit/permissions.test.ts).
// Signed-out: protected pages redirect to sign-in (DENY). The Claude/Duet/Shortcut token routes
// are not built in CC1, so their future entry points must be absent (DENY: 404).
test("signed-out requests to protected pages redirect to sign-in", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  for (const route of ["/home", "/settings"]) {
    const res = await ctx.get(route, { maxRedirects: 0 });
    expect(res.status(), `${route} should redirect`).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()["location"]).toContain("/signin");
  }
  await ctx.dispose();
});

test("token routes that arrive in later builds are absent in CC1", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  // Shortcut token routes (handoff §8.7, CC10) and note intake (CC4) — not built yet.
  for (const route of ["/api/phone/lookup", "/api/phone/mark", "/api/notes"]) {
    const res = await ctx.post(route, { data: {}, failOnStatusCode: false });
    expect(res.status(), `${route} should not exist yet`).toBe(404);
  }
  await ctx.dispose();
});

test("health route answers and lists the two logins", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; users: string[] };
  expect(body.ok).toBe(true);
  expect(body.users.sort()).toEqual(["christine", "josh"]);
  await ctx.dispose();
});
