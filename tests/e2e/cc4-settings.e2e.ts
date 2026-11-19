import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// Settings → Inbox & email (handoff §2, §2.1, §8.7, spec §1): connect Gmail, set the intake
// address, edit template B, issue/revoke the iPhone Shortcut token. Runs last among the cc4 suite
// so re-issuing the Shortcut token here does not invalidate the token the route tests rely on.

test("josh: Inbox & email settings — intake address, template B, Gmail, Shortcut token", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByRole("heading", { name: "Inbox & email" })).toBeVisible();

  // Gmail was connected in global-setup.
  await expect(page.getByTestId("gmail-status")).toHaveText("connected");

  // Intake address saves.
  await page.getByTestId("intake-input").fill("josh+notes@worthprop.com");
  await page.getByTestId("intake-save").click();
  await expect(page.getByTestId("intake-saved")).toBeVisible();

  // Template B must end at "Thanks," — an edit that does not is refused.
  await page.getByTestId("template-input").fill("Hi [first name], quick ping.");
  await page.getByTestId("template-save").click();
  await expect(page.getByTestId("template-error")).toBeVisible();

  // A valid template saves.
  await page.getByTestId("template-input").fill("Hi [first name], just following up. Thanks,");
  await page.getByTestId("template-save").click();
  await expect(page.getByTestId("template-saved")).toBeVisible();

  // Re-issue the Shortcut token: the plaintext is shown once.
  await page.getByTestId("shortcut-issue").click();
  await expect(page.getByTestId("new-shortcut-token")).toBeVisible();
  await expect(page.getByTestId("shortcut-status")).toHaveText("issued");

  // Revoke it: status drops to none.
  await page.getByTestId("shortcut-revoke").click();
  await expect(page.getByTestId("shortcut-status")).toHaveText("none");
});

test("josh: Gmail can be disconnected and reconnected", async ({ page }) => {
  await signIn(page, "josh");
  await page.goto("/settings");
  await expect(page.getByTestId("gmail-status")).toHaveText("connected");
  await page.getByTestId("gmail-disconnect").click();
  await expect(page.getByTestId("gmail-status")).toHaveText("not connected");
  // Restore the connection so later views that read Gmail state see it connected.
  await page.getByTestId("gmail-connect").click();
  await expect(page.getByTestId("gmail-status")).toHaveText("connected");
});
