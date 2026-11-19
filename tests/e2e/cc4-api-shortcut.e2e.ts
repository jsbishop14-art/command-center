import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// The iPhone Shortcut token and POST /api/notes (handoff §8.7, spec §4 check 2). The token works
// on the note route only and is refused on every other route. Tokens are issued in global-setup
// and written to .e2e/tokens.json. No real outside call, no real email.

function tokens(): { claude: string; duet: string; shortcut: string } {
  return JSON.parse(fs.readFileSync(path.resolve(".e2e/tokens.json"), "utf8"));
}

test("POST /api/notes refuses a missing or wrong token", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const none = await ctx.post("/api/notes", { data: { text: "hi" }, failOnStatusCode: false });
  expect(none.status()).toBe(401);
  const wrong = await ctx.post("/api/notes", {
    headers: { authorization: "Bearer not-a-real-token" },
    data: { text: "hi" },
    failOnStatusCode: false,
  });
  expect(wrong.status()).toBe(401);
  await ctx.dispose();
});

test("the Shortcut token adds a note (the Shortcut arrival path, handoff §11)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/notes", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { text: "Buy lag bolts for the Riverwood deck", source: "shortcut-e2e" },
  });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; id: string };
  expect(body.ok).toBe(true);
  expect(body.id).toMatch(/^N-\d{4,}$/);
  await ctx.dispose();
});

test("the Shortcut token is refused on the action-layer route (spec check 2)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { command: "list_cards" },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401); // not a valid action-layer token
  await ctx.dispose();
});

test("an action-layer (Claude) token is refused on the note route", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/notes", {
    headers: { authorization: `Bearer ${tokens().claude}` },
    data: { text: "should not be accepted" },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
  await ctx.dispose();
});
