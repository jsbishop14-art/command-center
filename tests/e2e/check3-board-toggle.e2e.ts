import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// Spec check 3: the board toggle choice survives a restart, per user. The choice is stored in the
// database per user, so a full page reload (which re-renders from the server) must bring it back,
// and one user's choice must not change another's.
test("board choice persists across reload and is independent per user", async ({ page }) => {
  await signIn(page, "josh");
  const board = () => page.getByRole("group", { name: "Board" });

  // Josh defaults to his own board.
  await expect(board().getByRole("button", { name: "Josh" })).toHaveAttribute("aria-pressed", "true");

  // Josh switches to Bishops.
  await board().getByRole("button", { name: "Bishops" }).click();
  await expect(board().getByRole("button", { name: "Bishops" })).toHaveAttribute("aria-pressed", "true");

  // Reload (server re-render from the database) — Bishops is still chosen.
  await page.reload();
  await expect(board().getByRole("button", { name: "Bishops" })).toHaveAttribute("aria-pressed", "true");

  // Christine signs in — her board is her own default, not Josh's Bishops choice.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/signin");
  await signIn(page, "christine");
  await expect(board().getByRole("button", { name: "Christine" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(board().getByRole("button", { name: "Bishops" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
