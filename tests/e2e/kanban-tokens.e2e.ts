import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Route-level permission map for the action layer (handoff §4.8; spec §4 checks 2, 3; handoff §11
// "Kanban storage" check 10: non-Mac-mini writers go through the app with a token). Tokens are
// issued in global-setup and written to .e2e/tokens.json.

function tokens(): { claude: string; duet: string } {
  return JSON.parse(fs.readFileSync(path.resolve(".e2e/tokens.json"), "utf8"));
}

test("the action layer refuses a request with no token", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/action", { data: { command: "list_cards" }, failOnStatusCode: false });
  expect(res.status()).toBe(401);
  await ctx.dispose();
});

test("the Claude token can list and add cards", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().claude;
  const list = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "list_cards" },
  });
  expect(list.ok()).toBe(true);
  const add = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "add_card", card: { title: "From the Claude token", boards: ["josh"], area: "business" } },
  });
  expect(add.ok()).toBe(true);
  await ctx.dispose();
});

test("the Claude token cannot move a card to done (handoff §4.7 rule 8)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().claude;
  const res = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "move_card", id: "CC-0001", stage: "done" },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(403);
  const body = (await res.json()) as { code: string };
  expect(body.code).toBe("limit");
  await ctx.dispose();
});

test("the Duet token is refused while the Duet switch is off", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().duet;
  const res = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "list_cards" },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(403);
  const body = (await res.json()) as { denied: string };
  expect(body.denied).toBe("duet_off");
  await ctx.dispose();
});
