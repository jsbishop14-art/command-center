import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// The iPhone Shortcut token on the phone routes (handoff §8.7, roles §7, spec §3). The token works
// on POST /api/phone/lookup and PUT/DELETE /api/phone/mark — and on no other route (the notes route
// is covered in cc4; the refusal on other routes is covered in cc4 + permissions). No real outside
// call, no AI. Tokens are issued in global-setup and written to .e2e/tokens.json.

function tokens(): { claude: string; duet: string; shortcut: string } {
  return JSON.parse(fs.readFileSync(path.resolve(".e2e/tokens.json"), "utf8"));
}

test("POST /api/phone/lookup refuses a missing or wrong token", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const none = await ctx.post("/api/phone/lookup", { data: { phone: "5615550111" }, failOnStatusCode: false });
  expect(none.status()).toBe(401);
  const wrong = await ctx.post("/api/phone/lookup", {
    headers: { authorization: "Bearer not-a-real-token" },
    data: { phone: "5615550111" },
    failOnStatusCode: false,
  });
  expect(wrong.status()).toBe(401);
  await ctx.dispose();
});

test("the Shortcut token looks up a number and returns the verdict + top reasons", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/phone/lookup", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { phone: "(561) 555-0111", source: "shortcut" },
  });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; verdict: string; reasons: string[]; summary: string };
  expect(body.ok).toBe(true);
  expect(body.verdict).toBe("telemarketer");
  expect(body.reasons.length).toBeLessThanOrEqual(2);
  expect(body.summary).toContain("Likely telemarketer");
  await ctx.dispose();
});

test("the Shortcut token marks and unmarks a number (PUT then DELETE)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const put = await ctx.put("/api/phone/mark", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { phone: "561-555-0160", label: "spam", note: "from the phone" },
  });
  expect(put.ok()).toBe(true);
  expect((await put.json()).label).toBe("spam");

  // The mark now overrides the verdict on a lookup (shared with the desktop).
  const look = await ctx.post("/api/phone/lookup", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { phone: "5615550160", source: "shortcut" },
  });
  expect((await look.json()).verdictLabel).toBe("Marked spam by Josh");

  const del = await ctx.delete("/api/phone/mark", {
    headers: { authorization: `Bearer ${tokens().shortcut}` },
    data: { phone: "5615550160" },
  });
  expect(del.ok()).toBe(true);
  await ctx.dispose();
});

test("a Claude action-layer token is refused on the phone routes (spec §3)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const look = await ctx.post("/api/phone/lookup", {
    headers: { authorization: `Bearer ${tokens().claude}` },
    data: { phone: "5615550111" },
    failOnStatusCode: false,
  });
  expect(look.status()).toBe(401);
  const mark = await ctx.put("/api/phone/mark", {
    headers: { authorization: `Bearer ${tokens().claude}` },
    data: { phone: "5615550111", label: "spam" },
    failOnStatusCode: false,
  });
  expect(mark.status()).toBe(401);
  await ctx.dispose();
});
