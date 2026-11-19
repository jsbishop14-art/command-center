import { test, expect, type Page } from "@playwright/test";
import { signIn, LOGINS } from "./util";

// CC6 browser tests (spec §4, handoff §11 "EZ Binder and schedule"). Each login reaches Money and
// Schedule from the menu (no direct URL). The money tiles show the synced /summary/ar values to the
// cent; the GC schedule grid shows the jobs and a slip-rule proposal with its source; Josh proposes
// a move and rejects a proposal. All against the stub — no real outside call.

async function openFromMenu(page: Page, name: string, urlPart: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).click();
  await page.waitForURL(`**/${urlPart}`);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

for (const who of Object.keys(LOGINS) as (keyof typeof LOGINS)[]) {
  test(`${who} reaches Money and Schedule from the menu`, async ({ page }) => {
    await signIn(page, who);

    await openFromMenu(page, "Money", "money");
    // The money tiles are to the cent from GET /summary/ar (stub), seeded by global-setup's refresh.
    await expect(page.getByTestId("money-open-a-r")).toHaveText("$243,187.42");
    await expect(page.getByTestId("money-over-30-days")).toHaveText("$98,650.10");
    await expect(page.getByTestId(`money-job-JOB-5521`)).toContainText("Riverwood pool house");

    await openFromMenu(page, "Schedule", "schedule");
    await expect(page.getByTestId("gc-row-JOB-5521")).toContainText("Riverwood pool house");
    // The slip rule proposed a shift for Riverwood's overrunning task; it shows as a proposal.
    await expect(page.getByTestId("gc-proposal-JOB-5521").first()).toBeVisible();
  });
}

test("Home shows the money tiles and the GC schedule grid from EZ Binder", async ({ page }) => {
  await signIn(page, "josh");
  await expect(page.getByTestId("money-open-a-r")).toHaveText("$243,187.42");
  const sched = page.locator(".gc-schedule");
  await expect(sched.getByTestId("gc-row-JOB-5521")).toContainText("Riverwood pool house");
  // A slip-rule proposal bar is present and names its source.
  await expect(sched.getByTestId("gc-proposal-JOB-5521").first()).toHaveAttribute("data-source", "rule");
});

test("Josh proposes a move; it shows as a proposal and can be rejected", async ({ page }) => {
  await signIn(page, "josh");
  await openFromMenu(page, "Schedule", "schedule");

  // Move the "Framing inspection" task (T-5521-3) to new dates. The move form prefills the task's
  // current dates; overwrite them and propose.
  const move = page.getByTestId("schedule-move");
  await move.getByLabel("Task to move").selectOption("T-5521-3");
  await move.getByLabel("New start").fill("2026-12-28");
  await move.getByLabel("New end").fill("2026-12-30");
  await page.getByTestId("schedule-move-submit").click();

  // A Josh proposal now shows in the Proposals list, changing nothing in EZ Binder.
  const joshProp = page.locator('[data-testid^="proposal-"][data-source="josh"]');
  await expect(joshProp.first()).toContainText("Proposed by Josh");

  // Reject it; it clears. The slip-rule proposal (rule) stays.
  await joshProp.first().getByRole("button", { name: "Reject" }).click();
  await expect(page.locator('[data-testid^="proposal-"][data-source="josh"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="proposal-"][data-source="rule"]').first()).toBeVisible();
});
