import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC8 — Builds screen, build questions and the build budget (spec §4 = handoff §11 "Builds", minus
// the touch-screen checks which are CC9). Reached from the app's own menu / top-bar bell (no direct
// URL), as each login. Everything runs against the GitHub stub seeded on first read; no real GitHub
// call. Tests run serially (workers: 1); the answer and override tests mutate the shared stub, so the
// read-only assertions (cards, budget HOLD, badge, bell count) come first.

test("Josh reaches Builds from the left menu and sees the project cards and the budget hold", async ({ page }) => {
  await signIn(page, "josh");

  // Reached by clicking the menu item, not a URL.
  await page.locator('nav[aria-label="Main"] a[href="/builds"]').click();
  await page.waitForURL("**/builds");
  await expect(page.getByRole("heading", { name: "Software builds" })).toBeVisible();

  // One card per tracked project, each with its stage (check 1).
  await expect(page.getByTestId("build-card-command-center")).toBeVisible();
  await expect(page.getByTestId("build-stage-ez-binder")).toHaveText("Needs Josh");
  await expect(page.getByTestId("build-stage-ez-draft")).toHaveText("Landed");
  await expect(page.getByTestId("build-queue-command-center")).toHaveText("7 of 10 builds landed");

  // The budget tile shows HOLD over the limit (check 5) and an Override button.
  await expect(page.getByTestId("budget-hold")).toBeVisible();
  await expect(page.getByTestId("budget-override")).toBeVisible();

  // The red Builds badge counts Needs-Josh projects; the bell counts alerts (check 2, non-touch).
  await expect(page.getByTestId("nav-count-builds")).toHaveText("1");
  await expect(page.getByTestId("bell-count")).toHaveText("2");
});

test("Christine reaches Builds from the top-bar bell", async ({ page }) => {
  await signIn(page, "christine");
  await page.getByTestId("bell").click();
  await page.waitForURL("**/builds");
  await expect(page.getByRole("heading", { name: "Software builds" })).toBeVisible();
  // Christine sees everything (handoff §1.1): the Needs-you panel is present.
  await expect(page.getByTestId("needsyou-ez-binder")).toBeVisible();
});

test("the Software builds settings card is reachable from the menu and lists the projects", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByRole("heading", { name: "Software builds" })).toBeVisible();
  await expect(page.getByTestId("proj-name-0")).toBeVisible();
  await expect(page.getByTestId("budget-limit")).toHaveValue("40000000");
});

test("Josh answers a build question; it is written and the runner command appears", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByTestId("bell").click();
  await page.waitForURL("**/builds");

  const panel = page.getByTestId("needsyou-ez-binder");
  await expect(panel.getByTestId("q-progress")).toHaveText("Q1 of 2");

  // Answer the first question by picking an option, then the second.
  await panel.getByTestId("q-opt-A").check();
  await panel.getByTestId("q-submit").click();
  await expect(panel.getByTestId("q-progress")).toHaveText("Q2 of 2");

  await panel.getByTestId("q-opt-B").check();
  await panel.getByTestId("q-submit").click();

  // Once no questions remain: "Answers saved" and the runner command to copy (check 3; process.md §11).
  await expect(panel.getByTestId("answers-saved")).toBeVisible();
  await expect(panel.getByTestId("runner-command")).toContainText("python3 ~/run_chain.py");

  // The badge drops now that nothing needs Josh (the only outstanding questions were EZ Binder's).
  await expect(page.getByTestId("nav-count-builds")).toHaveCount(0);
});

test("Override clears the build-budget hold", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByTestId("bell").click();
  await page.waitForURL("**/builds");

  await expect(page.getByTestId("budget-hold")).toBeVisible();
  await page.getByTestId("budget-override").click();

  // The hold clears and the override is shown in force (check 5: the next runner start proceeds).
  await expect(page.getByTestId("budget-hold")).toHaveCount(0);
  await expect(page.getByTestId("budget-override-active")).toBeVisible();
});
