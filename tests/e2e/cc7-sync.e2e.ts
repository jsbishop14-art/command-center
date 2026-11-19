import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC7 — Sync with Claude, Revert and usage (spec §4; handoff §11 "AI usage"). Each login reaches the
// Sync button from the app's own top bar (no direct URL) and runs it. Everything runs against the
// Claude stub; no real Claude call (spec §6). State is seeded once (global-setup): the EZ Binder
// stub gives two scheduled jobs with no cards yet, so Kanban updates add two cards and Schedule
// proposals propose two moves. Tests run serially (workers: 1), so Josh's kanban run and Christine's
// schedule run do not collide.

test("Josh opens Sync from the top bar, runs Kanban updates, reverts, then Revert all", async ({ page }) => {
  await signIn(page, "josh");

  // Reached by clicking the top-bar button, not a URL.
  await page.getByTestId("sync-open").click();
  const dialog = page.getByTestId("sync-dialog");
  await expect(dialog).toBeVisible();

  // The usage tiles and 30-day chart show on the popup (handoff §5.1, §5.5).
  await expect(page.getByTestId("sync-tile-week")).toBeVisible();
  await expect(page.getByTestId("sync-usage-chart")).toBeVisible();

  // Run only Kanban updates: uncheck the other two so the run is deterministic.
  await page.getByTestId("sync-item-inbox").uncheck();
  await page.getByTestId("sync-item-schedule").uncheck();
  await expect(page.getByTestId("sync-count-kanban")).toContainText("2 changes");

  await page.getByTestId("sync-run").click();
  await expect(page.getByTestId("sync-results")).toBeVisible();

  // Two kanban changes, each revertable.
  await expect(page.getByTestId("sync-change-0")).toBeVisible();
  await expect(page.getByTestId("sync-change-1")).toBeVisible();

  // Revert the first change: it shows "Reverted" and the button goes away.
  await page.getByTestId("sync-revert-0").click();
  await expect(page.getByTestId("sync-reverted-0")).toBeVisible();

  // Revert all undoes the rest of the run.
  await page.getByTestId("sync-revert-all").click();
  await expect(page.getByTestId("sync-reverted-1")).toBeVisible();

  await page.getByTestId("sync-done").click();
  await expect(dialog).toBeHidden();
});

test("Christine reaches Sync from the top bar and runs Schedule proposals", async ({ page }) => {
  await signIn(page, "christine");

  await page.getByTestId("sync-open").click();
  const dialog = page.getByTestId("sync-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("sync-usage-chart")).toBeVisible();

  // Run only Schedule proposals (two active/sold jobs, untouched by Josh's kanban run).
  await page.getByTestId("sync-item-inbox").uncheck();
  await page.getByTestId("sync-item-kanban").uncheck();
  await expect(page.getByTestId("sync-count-schedule")).toContainText("2 jobs");

  await page.getByTestId("sync-run").click();
  await expect(page.getByTestId("sync-results")).toBeVisible();

  // Each proposal shows a Withdraw button (handoff §5.4: a reverted proposal is withdrawn).
  await expect(page.getByTestId("sync-revert-0")).toContainText("Withdraw");
  await page.getByTestId("sync-revert-all").click();
  await expect(page.getByTestId("sync-reverted-0")).toBeVisible();

  await page.getByTestId("sync-done").click();
  await expect(dialog).toBeHidden();
});
