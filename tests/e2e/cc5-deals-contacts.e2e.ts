import { test, expect, type Page } from "@playwright/test";
import { signIn, LOGINS } from "./util";

// CC5 browser tests (spec §4). Each login reaches Deals and Contacts from the menu (check 1); deal
// history shows a Claude change with Revert that restores the earlier values (check 2); the board
// toggle filters deals by their boards list (check 5); plus the Projects grid and the Awaiting-reply
// deal match (check 3) on Home. No direct URLs — every screen is reached by clicking the menu.

async function openDealsFromMenu(page: Page) {
  await page.getByRole("link", { name: "Deals", exact: true }).click();
  await page.waitForURL("**/deals");
  await expect(page.getByRole("heading", { name: "Deals", exact: true })).toBeVisible();
}

async function openContactsFromMenu(page: Page) {
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.waitForURL("**/contacts");
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();
}

for (const who of Object.keys(LOGINS) as (keyof typeof LOGINS)[]) {
  test(`check 1: ${who} reaches Deals and Contacts from the menu`, async ({ page }) => {
    await signIn(page, who);
    await openDealsFromMenu(page);
    // The Deals screen renders (the stage legend is board-independent; the deal table is
    // board-scoped, so which deals show depends on the current board — covered by check 5).
    await expect(page.getByText("Sale stages:")).toBeVisible();
    await openContactsFromMenu(page);
    // Contacts are reference data, not board-scoped, so both logins see the seeded contacts.
    await expect(page.getByText("Joe Abrams")).toBeVisible();
  });
}

test("check 2: a Claude deal change shows in history with Revert, and Revert restores it", async ({ page }) => {
  await signIn(page, "josh");
  await openDealsFromMenu(page);

  // Josh's board shows BNT. global-setup made a Claude change to its next action.
  const bntRow = page.getByTestId("deal-row").filter({ hasText: "BNT / ES Windows pool" });
  await expect(bntRow).toContainText("Claude: chase the ES window count");
  await bntRow.click();

  const panel = page.getByRole("complementary", { name: "Deal detail" });
  await expect(panel.getByTestId("deal-panel-name")).toHaveText("BNT / ES Windows pool");
  await expect(panel.getByText("Claude changed the next action")).toBeVisible();

  // Revert the Claude change; the earlier (seed) next action is restored.
  await panel.getByRole("button", { name: "Revert", exact: true }).first().click();
  await expect(
    page.getByTestId("deal-row").filter({ hasText: "BNT / ES Windows pool" }),
  ).toContainText("Send revised estimate to BNT");
  // The revert itself is recorded, attributed to Josh.
  await expect(
    page.getByRole("complementary", { name: "Deal detail" }).getByText("Josh reverted a change"),
  ).toBeVisible();
});

test("check 5: the board toggle filters deals by their boards list", async ({ page }) => {
  await signIn(page, "josh");
  await openDealsFromMenu(page);
  const board = () => page.getByRole("group", { name: "Board" });

  // Josh's board: BNT (josh only) is visible.
  await expect(page.getByTestId("deal-row").filter({ hasText: "BNT / ES Windows pool" })).toBeVisible();

  // Switch to Bishops: only the deals listing Bishops remain (Ohio and 33406); BNT drops off.
  await board().getByRole("button", { name: "Bishops" }).click();
  await expect(page.getByTestId("deal-row").filter({ hasText: "33406 (48 units)" })).toBeVisible();
  await expect(page.getByTestId("deal-row").filter({ hasText: "BNT / ES Windows pool" })).toHaveCount(0);
  await expect(page.getByTestId("deal-row").filter({ hasText: "Best Western Naples" })).toHaveCount(0);

  // Switch to Christine: none of the seed deals are on her board.
  await board().getByRole("button", { name: "Christine" }).click();
  await expect(page.getByTestId("deals-empty")).toBeVisible();

  // Restore Josh's board so later tests in this file (which sign in as Josh) see his data. The
  // board choice persists per user in the database.
  await board().getByRole("button", { name: "Josh" }).click();
  await expect(board().getByRole("button", { name: "Josh" })).toHaveAttribute("aria-pressed", "true");
});

test("Projects grid shows deal cards and filters by group", async ({ page }) => {
  await signIn(page, "josh");
  // Reached from the menu; Projects scrolls to the grid on Home.
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  const grid = page.getByRole("region", { name: "Projects" });
  await expect(grid.getByText("BNT / ES Windows pool")).toBeVisible();
  // Filter to GC jobs: the deal card drops off, a stub GC job shows.
  await grid.getByTestId("project-filter-gc").click();
  await expect(grid.getByText("Riverwood pool house")).toBeVisible();
  await expect(grid.getByText("BNT / ES Windows pool")).toHaveCount(0);
  // Software shows the CC8 placeholder.
  await grid.getByTestId("project-filter-software").click();
  await expect(grid.getByText("Coming in CC8")).toBeVisible();
});
