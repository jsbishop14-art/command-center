import { test, expect } from "@playwright/test";

// Spec check 2: wrong password is refused; signed-out users reach nothing but the sign-in page.
test("wrong password is refused and stays on sign-in", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Username").fill("josh");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".error")).toContainText("not right");
  await expect(page).toHaveURL(/\/signin$/);
});

test("signed-out users are sent to sign-in from every protected page", async ({ page }) => {
  for (const route of ["/home", "/settings", "/soon?s=Kanban"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  }
});
