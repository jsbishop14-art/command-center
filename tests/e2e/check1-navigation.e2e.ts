import { test, expect } from "@playwright/test";
import { signIn, LOGINS } from "./util";

// Spec check 1: each login signs in and reaches Home and Settings from the menus (no direct URL).
for (const who of ["josh", "christine"] as const) {
  test(`${who} signs in and reaches Home and Settings from the menu`, async ({ page }) => {
    await signIn(page, who);

    // Reach Settings by clicking the menu item.
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("**/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

    // The signed-in name shows in the top bar (Christine sees everything — same menu).
    await expect(page.getByText(LOGINS[who].display, { exact: true }).first()).toBeVisible();
  });
}

test("a not-yet-built screen shows 'Coming in a later build'", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL("**/soon**");
  await expect(page.getByTestId("coming-soon")).toHaveText("Coming in a later build.");
});
