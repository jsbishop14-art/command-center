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

test("phone-lookup routes are still absent until CC10", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  // Phone lookup/mark routes arrive in CC10; their entry points must still be absent.
  for (const route of ["/api/phone/lookup", "/api/phone/mark"]) {
    const res = await ctx.post(route, { data: {}, failOnStatusCode: false });
    expect(res.status(), `${route} should not exist yet`).toBe(404);
  }
  await ctx.dispose();
});

// Inverted from CC1 (where /api/notes 404'd): CC4 builds the note intake route. It now exists and
// refuses a request with no Shortcut token (401), rather than 404 (handoff §8.7, spec check 2).
test("POST /api/notes exists in CC4 and refuses without a Shortcut token", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/notes", { data: { text: "hi" }, failOnStatusCode: false });
  expect(res.status()).toBe(401);
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
