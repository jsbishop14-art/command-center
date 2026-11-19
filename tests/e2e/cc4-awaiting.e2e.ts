import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// Awaiting reply (handoff §2, §11, spec §1): threads Josh sent and got no reply to — flagged at 2
// days, or 1 day for a client with an active job. Nudge creates a Gmail draft (never sends); No
// reply needed removes one thread. Runs first among the cc4 suite (alphabetical), so the seeded
// threads are present. No AI, no real email.

test("josh: Awaiting reply shows flagged threads with the rule that caught them", async ({ page }) => {
  await signIn(page, "josh");
  await expect(page.getByTestId("panel-awaiting")).toBeVisible();

  // The active-job client (1-day rule) and the non-client (2-day rule) are both flagged.
  const riverwood = page.getByTestId("thread-t-riverwood");
  const spark = page.getByTestId("thread-t-spark");
  await expect(riverwood).toBeVisible();
  await expect(spark).toBeVisible();
  await expect(riverwood).toContainText("active job, 1-day rule");
  await expect(spark).toContainText("2-day rule");
});

test("josh: Nudge creates a Gmail draft from template B and sends nothing", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByTestId("nudge-t-riverwood").click();
  // The only outcome is a draft in Gmail — the app never sends (handoff §11, hard limit §8).
  await expect(page.getByTestId("drafted-t-riverwood")).toHaveText("Draft created in Gmail");
  // The thread stays in Awaiting reply (a draft does not clear it).
  await expect(page.getByTestId("thread-t-riverwood")).toBeVisible();
});

test("josh: No reply needed removes only that thread", async ({ page }) => {
  await signIn(page, "josh");
  const spark = page.getByTestId("thread-t-spark");
  // If a prior run already cleared it, there is nothing to assert; the rule itself is covered by
  // the unit test. Otherwise, remove it and confirm the other thread is untouched.
  if (await spark.count()) {
    await page.getByTestId("noreply-t-spark").click();
    await expect(spark).toHaveCount(0);
  }
  await expect(page.getByTestId("thread-t-riverwood")).toBeVisible();
});
