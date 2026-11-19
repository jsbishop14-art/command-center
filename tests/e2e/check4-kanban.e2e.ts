import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signIn } from "./util";

// Spec §4 check 4: a browser test reaches the board and a card panel from the menu as each login.
// Plus quick add, and a hand edit showing in the app (handoff §11 "Kanban storage" check 1).

// The board toggle persists per user across tests (CC1 check 3 leaves it set), so each test picks
// the board it needs explicitly through the top-bar toggle.
async function selectBoard(page: Page, name: "Josh" | "Christine" | "Bishops") {
  const btn = page.getByRole("group", { name: "Board" }).getByRole("button", { name, exact: true });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
}

async function openKanban(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL("**/kanban");
}

test("Josh reaches the board and a card panel from the menu", async ({ page }) => {
  await signIn(page, "josh");
  await selectBoard(page, "Josh");
  await openKanban(page);
  await expect(page.getByRole("heading", { name: "Kanban", exact: true })).toBeVisible();
  // Columns render.
  await expect(page.getByRole("region", { name: "In progress" })).toBeVisible();
  // A seeded card on Josh's board, then its detail panel.
  const card = page.getByText("Ohio sites presentation", { exact: true });
  await expect(card).toBeVisible();
  await card.click();
  await page.waitForURL("**/kanban?*card=*");
  await expect(page.getByRole("complementary", { name: "Card detail" })).toBeVisible();
  await expect(page.getByText(/Card ·/)).toBeVisible();
});

test("a Claude-created card shows 'Added by Claude'", async ({ page }) => {
  await signIn(page, "josh");
  await selectBoard(page, "Josh");
  await openKanban(page);
  await expect(page.getByText("Added by Claude", { exact: true })).toBeVisible();
});

test("Christine reaches her board and a card panel from the menu", async ({ page }) => {
  await signIn(page, "christine");
  await selectBoard(page, "Christine");
  await openKanban(page);
  await expect(page.getByRole("heading", { name: "Kanban", exact: true })).toBeVisible();
  const card = page.getByText("Family calendar sync", { exact: true });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("complementary", { name: "Card detail" })).toBeVisible();
});

test("quick add creates a card on the current board", async ({ page }) => {
  await signIn(page, "josh");
  await selectBoard(page, "Josh");
  await openKanban(page);
  await page.getByTestId("add-card").click();
  await page.getByLabel("Card title").fill("A brand new quick-add card");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("A brand new quick-add card", { exact: true })).toBeVisible();
});

test("a hand edit to a card file shows in the app", async ({ page }) => {
  await signIn(page, "josh");
  await selectBoard(page, "Josh");
  await openKanban(page);
  await expect(page.getByText("Ohio sites presentation", { exact: true })).toBeVisible();

  // Edit the card file directly (as a hand edit on the Mac mini would).
  const dir = process.env.CC_KANBAN_DIR || ".e2e/kanban";
  const file = path.join(dir, "cards", "CC-0001.md");
  const text = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text.replace("Ohio sites presentation", "Ohio sites presentation (edited by hand)"));

  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByText("Ohio sites presentation (edited by hand)", { exact: true })).toBeVisible();
});
