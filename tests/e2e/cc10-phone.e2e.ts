import { test, expect, type Page } from "@playwright/test";
import { signIn, LOGINS } from "./util";

// CC10 — phone lookup (spec §4, handoff §8). Reached from the app's own left menu (no direct URL).
// Available to both logins, not tied to a board (§8.8). All against the stubs — no real Twilio, FTC
// or FCC call, no AI. The 80%-test-list check is Josh's, after the keys are in.

async function openPhoneFromMenu(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Phone lookup" }).click();
  await page.waitForURL("**/phone");
  await expect(page.getByRole("heading", { name: "Phone lookup", exact: true })).toBeVisible();
}

async function lookUp(page: Page, number: string) {
  await page.getByLabel("Phone number").fill(number);
  await page.getByRole("button", { name: "Look up" }).click();
  await page.waitForURL("**/phone?sel=*");
}

for (const who of Object.keys(LOGINS) as (keyof typeof LOGINS)[]) {
  test(`${who} reaches Phone lookup from the menu and sees the empty state`, async ({ page }) => {
    await signIn(page, who);
    await openPhoneFromMenu(page);
    await expect(page.getByTestId("phone-empty")).toBeVisible();
    // Status line shows the FTC backfill (stub completes instantly) and the FCC note.
    await expect(page.getByText("FCC live · 3 s timeout")).toBeVisible();
    await expect(page.getByTestId("ftc-progress")).toHaveText("100%");
  });
}

test("check 1: a known spammer in any format returns a verdict with reasons (desktop)", async ({ page }) => {
  await signIn(page, "josh");
  await openPhoneFromMenu(page);
  await lookUp(page, "(561) 555-0111");

  const verdict = page.getByTestId("phone-verdict");
  await expect(verdict).toHaveAttribute("data-verdict", "telemarketer");
  await expect(verdict).toContainText("Likely telemarketer");
  // Reasons are plain words; FTC count comes from the ingested stub data.
  await expect(page.getByTestId("phone-reasons")).toContainText("FTC complaints in the last 12 months");
  await expect(page.getByTestId("phone-ftc")).toHaveText("24");
  await expect(page.getByTestId("phone-fcc")).toHaveText("5");
});

test("check 5: a spam mark overrides the verdict for both users; removing it restores scoring", async ({ page }) => {
  // Josh marks a number spam.
  await signIn(page, "josh");
  await openPhoneFromMenu(page);
  await lookUp(page, "800-555-0144");
  await expect(page.getByTestId("phone-verdict")).toContainText("Likely telemarketer"); // scored first
  await page.getByTestId("phone-mark-spam").click();
  await page.waitForURL("**/phone?sel=8005550144");
  await expect(page.getByTestId("phone-mark")).toContainText("Marked spam by Josh");

  // Christine sees the same shared mark on her own lookup (handoff §8.4).
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "christine");
  await openPhoneFromMenu(page);
  await lookUp(page, "8005550144");
  await expect(page.getByTestId("phone-verdict")).toContainText("Marked spam by Josh");
  await expect(page.getByTestId("phone-mark")).toContainText("Marked spam by Josh");

  // Removing the mark restores scoring on the next lookup.
  await page.getByTestId("phone-unmark").click();
  await page.waitForURL("**/phone?sel=8005550144");
  await lookUp(page, "8005550144");
  await expect(page.getByTestId("phone-verdict")).toContainText("Likely telemarketer");
  await expect(page.getByTestId("phone-mark")).toHaveCount(0);
});

test("history: a lookup shows in history, is searchable, and re-opens on click", async ({ page }) => {
  await signIn(page, "josh");
  await openPhoneFromMenu(page);
  await lookUp(page, "561 555 0170"); // a real person → green
  await expect(page.getByTestId("phone-verdict")).toHaveAttribute("data-verdict", "real");

  // It appears in history; search by number narrows to it; the row re-opens the result.
  const row = page.getByTestId("phone-history-row").filter({ hasText: "(561) 555-0170" });
  await expect(row).toBeVisible();
  await page.getByLabel("Search history").fill("5615550170");
  await page.getByLabel("Search history").press("Enter");
  await page.waitForURL("**/phone?*q=5615550170*");
  await expect(page.getByTestId("phone-history-row")).toHaveCount(1);
  await page.getByTestId("phone-history-row").first().click();
  await page.waitForURL("**/phone?sel=5615550170*");
  await expect(page.getByTestId("phone-verdict")).toContainText("Likely real person");
});

test("Quick add (Ctrl K) recognizes a pasted number and offers Look up number (handoff §8.2)", async ({ page }) => {
  await signIn(page, "josh");
  // Quick add is in the top bar on every screen.
  await page.getByTestId("add-card").click();
  const dialog = page.getByRole("dialog", { name: "Quick add card" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Card title").fill("(561) 555-0199");
  await expect(page.getByTestId("qa-lookup-offer")).toBeVisible();
  await page.getByTestId("qa-lookup").click();
  await page.waitForURL("**/phone?sel=5615550199");
  await expect(page.getByTestId("phone-verdict")).toBeVisible();
});

test("an unrecognized number shows an error, not a result", async ({ page }) => {
  await signIn(page, "josh");
  await openPhoneFromMenu(page);
  await page.getByLabel("Phone number").fill("not a number");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.waitForURL("**/phone?*err=1*");
  await expect(page.getByTestId("phone-error")).toBeVisible();
});
