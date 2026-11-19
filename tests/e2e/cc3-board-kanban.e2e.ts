import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC3 spec check 5: the board toggle changes the Kanban panel's cards. Josh's board has an
// in-progress card ("Ohio sites presentation"); Christine's has a different one ("Plan weekend
// groceries"). Switching the board swaps the panel's cards (handoff §1.3, spec §3).
test("the board toggle swaps the Kanban in-progress panel's cards", async ({ page }) => {
  await signIn(page, "josh");

  const panel = page.getByTestId("panel-kanban");
  await expect(panel.getByText("Ohio sites presentation")).toBeVisible();
  await expect(panel.getByText("Plan weekend groceries")).toHaveCount(0);

  // Switch to Christine's board.
  await page.getByRole("group", { name: "Board" }).getByRole("button", { name: "Christine" }).click();

  await expect(panel.getByText("Plan weekend groceries")).toBeVisible();
  await expect(panel.getByText("Ohio sites presentation")).toHaveCount(0);

  // Restore Josh's board for later tests.
  await page.getByRole("group", { name: "Board" }).getByRole("button", { name: "Josh" }).click();
  await expect(panel.getByText("Ohio sites presentation")).toBeVisible();
});
