import { expect, type Page } from "@playwright/test";

export const LOGINS = {
  josh: { username: "josh", password: "josh-dev-password", display: "Josh" },
  christine: { username: "christine", password: "christine-dev-password", display: "Christine" },
};

// Sign in through the app's own sign-in page (no direct URL to protected pages).
export async function signIn(page: Page, who: keyof typeof LOGINS) {
  const login = LOGINS[who];
  await page.goto("/signin");
  await page.getByLabel("Username").fill(login.username);
  await page.getByLabel("Password").fill(login.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
}
