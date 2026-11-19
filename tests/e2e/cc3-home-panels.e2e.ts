import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC3 spec check 1: as each login, Home loads; panels reorder and collapse and stay that way after
// a restart (a full reload re-renders from the per-user pref in the database). Each test restores
// the default layout at the end so later tests see Josh's/Christine's panels in their default
// state (the test database is shared across the run).
for (const who of ["josh", "christine"] as const) {
  test(`${who}: Home panels reorder and collapse, and persist across a reload`, async ({ page }) => {
    await signIn(page, who);
    const order = () =>
      page.locator('[data-testid^="panel-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));

    expect(await order()).toEqual(["panel-today", "panel-inbox", "panel-awaiting", "panel-kanban"]);

    // Reorder: move Kanban up one place.
    await page.getByTestId("up-kanban").click();
    await expect.poll(order).toEqual(["panel-today", "panel-inbox", "panel-kanban", "panel-awaiting"]);

    // Collapse the Today panel.
    await expect(page.getByTestId("body-today")).toBeVisible();
    await page.getByTestId("collapse-today").click();
    await expect(page.getByTestId("body-today")).toHaveCount(0);

    // Let the per-user save settle, then reload: the order and collapsed state come back.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect.poll(order).toEqual(["panel-today", "panel-inbox", "panel-kanban", "panel-awaiting"]);
    await expect(page.getByTestId("body-today")).toHaveCount(0);
    await expect(page.getByTestId("collapse-today")).toHaveAttribute("aria-expanded", "false");

    // Restore the default layout for later tests.
    await page.getByTestId("collapse-today").click();
    await expect(page.getByTestId("body-today")).toBeVisible();
    await page.getByTestId("down-kanban").click();
    await expect.poll(order).toEqual(["panel-today", "panel-inbox", "panel-awaiting", "panel-kanban"]);
    await page.waitForLoadState("networkidle");
  });
}
