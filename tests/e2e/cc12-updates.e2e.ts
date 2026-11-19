import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC12 check 2: the Settings → Updates section shows the live version and when the last update check
// ran, and "Check for updates now" runs one pass and reports the result. Reached by clicking from the
// app's own menu (no direct URL), as each login. In the e2e environment there is no git remote, so a
// check reports "up to date" (the button and its wiring are what this proves).

for (const who of ["josh", "christine"] as const) {
  test(`${who}: Updates section — live version, last check, Check for updates now`, async ({ page }) => {
    await signIn(page, who);
    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("**/settings");

    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
    await expect(page.getByTestId("updates-panel")).toBeVisible();
    // The live-version line is present (recorded on the Mac mini at install; not recorded in e2e).
    await expect(page.getByTestId("updates-live")).toBeVisible();

    // Run one check from the button; it reports a result.
    await page.getByTestId("updates-check").click();
    await expect(page.getByTestId("updates-result")).toBeVisible();
    // The last-checked line now shows a time and the outcome ("Already up to date." in e2e).
    await expect(page.getByTestId("updates-last")).toContainText("up to date");
  });
}
