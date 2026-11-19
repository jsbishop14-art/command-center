import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC3 spec check 2: with stubbed calendars, events from all three calendars appear in the right
// person colours, plus a kanban card due today. Josh's board has a due-today card seeded in
// global-setup; the three calendars are connected and refreshed there.
test("Today panel shows events from all three calendars in their colours, plus a due card", async ({ page }) => {
  await signIn(page, "josh");

  // Defensive: a prior test may have left Today collapsed.
  if ((await page.getByTestId("body-today").count()) === 0) {
    await page.getByTestId("collapse-today").click();
  }
  await expect(page.getByTestId("body-today")).toBeVisible();

  const colours = await page
    .getByTestId("panel-today")
    .locator(".today-row .bar")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-color")));

  expect(colours).toContain("#16181D"); // Josh work
  expect(colours).toContain("#8A8F99"); // Josh personal
  expect(colours).toContain("#2F5BD3"); // Christine
  expect(colours).toContain("#C2410C"); // the due card

  await expect(page.getByTestId("today-due").first()).toBeVisible();
  await expect(page.getByText("Call ES rep about pool order")).toBeVisible();
});
