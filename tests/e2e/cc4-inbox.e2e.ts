import { test, expect, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signIn } from "./util";

// Inbox: pending notes, reached from the left menu, with Confirm/Change/Dismiss (handoff §2, §4.4,
// spec §1). Nothing becomes a card without Confirm. Notes are created through the Shortcut route so
// each run operates on its own notes (retry-safe) and does not disturb the seeded intake notes.

function shortcutToken(): string {
  return (JSON.parse(fs.readFileSync(path.resolve(".e2e/tokens.json"), "utf8")) as { shortcut: string }).shortcut;
}

async function addNote(baseURL: string | undefined, text: string): Promise<string> {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/notes", {
    headers: { authorization: `Bearer ${shortcutToken()}` },
    data: { text },
  });
  const body = (await res.json()) as { id: string };
  await ctx.dispose();
  return body.id;
}

test("josh: Inbox is reachable from the left menu and lists the seeded notes", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("link", { name: "Inbox" }).click();
  await page.waitForURL("**/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  // The two seeded intake notes (email + text-to-email) are present.
  await expect(page.getByTestId("note-N-0001")).toBeVisible();
  await expect(page.getByTestId("note-N-0002")).toBeVisible();
});

test("josh: Confirm files a note as a card; Dismiss removes one without a card", async ({ page, baseURL }) => {
  const toConfirm = await addNote(baseURL, "CONFIRM ME: order the pool tile");
  const toDismiss = await addNote(baseURL, "DISMISS ME: ignore this one");

  await signIn(page, "josh");
  await page.goto("/inbox");

  // Confirm → the note leaves the Inbox and becomes a card in the Kanban Inbox column.
  await expect(page.getByTestId(`note-${toConfirm}`)).toBeVisible();
  await page.getByTestId(`confirm-${toConfirm}`).click();
  await expect(page.getByTestId(`note-${toConfirm}`)).toHaveCount(0);

  // Dismiss → the note is removed with no card.
  await expect(page.getByTestId(`note-${toDismiss}`)).toBeVisible();
  await page.getByTestId(`dismiss-${toDismiss}`).click();
  await expect(page.getByTestId(`note-${toDismiss}`)).toHaveCount(0);

  // The confirmed note is now a card on the board; the dismissed one is nowhere.
  await page.goto("/kanban");
  await expect(page.getByText("order the pool tile")).toBeVisible();
  await expect(page.getByText("ignore this one")).toHaveCount(0);
});

test("josh: Change lets him pick a project and board before confirming", async ({ page, baseURL }) => {
  const id = await addNote(baseURL, "CHANGE ME: call the inspector");
  await signIn(page, "josh");
  await page.goto("/inbox");

  await page.getByTestId(`change-${id}`).click();
  await expect(page.getByTestId(`change-fields-${id}`)).toBeVisible();
  await page.getByTestId(`project-${id}`).fill("riverwood");
  // Put it on Christine's board as well as the default.
  await page.getByTestId(`board-${id}-christine`).check();
  await page.getByTestId(`confirm-${id}`).click();
  await expect(page.getByTestId(`note-${id}`)).toHaveCount(0);

  await page.goto("/kanban");
  await expect(page.getByText("call the inspector")).toBeVisible();
});

test("christine: sees the Inbox screen too (handoff §1.1)", async ({ page }) => {
  await signIn(page, "christine");
  await page.getByRole("link", { name: "Inbox" }).click();
  await page.waitForURL("**/inbox");
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
});
