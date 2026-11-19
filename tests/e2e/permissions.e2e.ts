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

// Inverted from CC1 (where these 404'd): CC10 builds the phone lookup/mark routes. They now exist
// and refuse a request with no Shortcut token (401), rather than 404 (handoff §8.7, roles §7). The
// lookup route is POST; mark is PUT/DELETE. The token's full allow/deny is in cc10-api-phone.
test("phone-lookup routes exist in CC10 and refuse without a Shortcut token", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const look = await ctx.post("/api/phone/lookup", { data: { phone: "5615550111" }, failOnStatusCode: false });
  expect(look.status()).toBe(401);
  const mark = await ctx.put("/api/phone/mark", { data: { phone: "5615550111", label: "spam" }, failOnStatusCode: false });
  expect(mark.status()).toBe(401);
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
