import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Action-layer deal commands (handoff §4.8: update_deal, read_deal; spec §3: deals always go
// through the action layer). Permission map for the new commands, deny and allow (CLAUDE §4, §7):
//   Claude token  -> update_deal / read_deal: ALLOW
//   Duet token    -> refused while the Duet switch is off (403 duet_off)
//   Shortcut token / no token -> the action route is refused (covered in permissions.e2e.ts)
// Operates on NeighborLee Living (seed id 5) so it never disturbs the BNT deal the browser Revert
// test (cc5-deals-contacts.e2e.ts) relies on.

function tokens(): { claude: string; duet: string } {
  return JSON.parse(fs.readFileSync(path.resolve(".e2e/tokens.json"), "utf8"));
}

const NEIGHBORLEE_ID = 5;

test("the Claude token can read and update a deal through the action layer", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().claude;

  const read = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "read_deal", id: NEIGHBORLEE_ID },
  });
  expect(read.ok()).toBe(true);
  const readBody = (await read.json()) as { ok: boolean; deal: { name: string; probability: number | null } };
  expect(readBody.deal.name).toBe("NeighborLee Living");

  const update = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "update_deal", id: NEIGHBORLEE_ID, changes: { probability: 25 } },
  });
  expect(update.ok()).toBe(true);
  const updBody = (await update.json()) as { ok: boolean; deal: { probability: number } };
  expect(updBody.deal.probability).toBe(25);
  await ctx.dispose();
});

test("update_deal rejects an invalid stage for the deal's type (400)", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().claude;
  // NeighborLee is a Development deal; a Sale-only stage must be rejected.
  const res = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "update_deal", id: NEIGHBORLEE_ID, changes: { stage: "Negotiating" } },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(400);
  await ctx.dispose();
});

test("the Duet token is refused for a deal command while the Duet switch is off", async ({ baseURL }) => {
  const ctx = await request.newContext({ baseURL });
  const t = tokens().duet;
  const res = await ctx.post("/api/action", {
    headers: { authorization: `Bearer ${t}` },
    data: { command: "read_deal", id: NEIGHBORLEE_ID },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(403);
  const body = (await res.json()) as { denied: string };
  expect(body.denied).toBe("duet_off");
  await ctx.dispose();
});
