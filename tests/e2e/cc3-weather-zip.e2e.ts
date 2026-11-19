import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC3 spec check 3: changing the zip in Settings changes the weather source request (stubbed). The
// stub derives the reading from the zip, so a new zip produces a new request and a new reading.
// Zip 33472 -> 79°, zip 90210 -> 72° (sum-of-digits stub). Restores 33472 at the end.
test("changing the saved zip changes the weather the next Refresh pulls", async ({ page }) => {
  await signIn(page, "josh");

  // Seeded Refresh used the default zip 33472.
  await expect(page.getByTestId("weather-temp")).toHaveText("79°");
  await expect(page.getByTestId("weather")).toContainText("33472");

  // Change the zip in Settings.
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");
  await page.getByTestId("zip-input").fill("90210");
  await page.getByTestId("zip-form").getByRole("button", { name: "Save zip" }).click();
  await expect(page.getByTestId("zip-saved")).toBeVisible();

  // Back on Home the top bar shows the new zip; Refresh pulls a new reading for it.
  await nav.getByRole("link", { name: "Home" }).click();
  await page.waitForURL("**/home");
  await expect(page.getByTestId("weather")).toContainText("90210");
  await page.getByTestId("refresh").click();
  await expect(page.getByTestId("weather-temp")).toHaveText("72°");

  // Restore the default zip for later tests.
  await nav.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");
  await page.getByTestId("zip-input").fill("33472");
  await page.getByTestId("zip-form").getByRole("button", { name: "Save zip" }).click();
  await expect(page.getByTestId("zip-saved")).toBeVisible();
  await nav.getByRole("link", { name: "Home" }).click();
  await page.waitForURL("**/home");
  await page.getByTestId("refresh").click();
  await expect(page.getByTestId("weather-temp")).toHaveText("79°");
});
