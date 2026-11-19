import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./util";
import { commit } from "../../src/lib/builds/github";
import { commitBudget } from "../../src/lib/builds/writer";
import { statusPath } from "../../src/lib/builds/state";

// CC9 — the ambient touch screen (spec §4, handoff §6). Reached from the app's own left menu (no
// direct URL), as each login. The screen opens on screen 2 with the alert banner when a build needs
// Josh or the budget hold is on. Earlier suites (cc8) answer EZ Binder's questions and override the
// hold in the shared stub, so beforeAll re-establishes both — a fresh unanswered question on EZ
// Binder and a budget back over its limit — directly in the same local test DB the server reads (the
// pattern global-setup uses). No real outside call, no AI.

test.beforeAll(() => {
  // Match global-setup / playwright.config so getDb() here resolves to the DB the server reads.
  process.env.CC_DB_PATH = process.env.CC_DB_PATH || path.resolve(".e2e/cc.db");
  process.env.CC_KANBAN_DIR = process.env.CC_KANBAN_DIR || path.resolve(".e2e/kanban");
  process.env.CC_SECRET_KEY =
    process.env.CC_SECRET_KEY || "0000000000000000000000000000000000000000000000000000000000000000";
  delete process.env.CC_LIVE_GITHUB;

  const status = [
    "# S157 status",
    "",
    "## PICK UP HERE",
    "",
    "Blocked on a decision before the touch-screen check.",
    "",
    "## Questions",
    "",
    "Q1. [S157-ASK-1] Should the touch screen jump on a new question?",
    "Options: A) Yes  B) No",
    "My recommendation: A — that is the point of the ambient screen.",
    "",
  ].join("\n");
  commit("ez-binder", "s157-changes-feed", [{ path: statusPath("S157"), content: status }], "S157 fresh question [skip ci]", "cc9-e2e");
  // Clear any override and drop the limit below this week's usage → HOLD on.
  commitBudget({ overrideUntil: null, weeklyLimitTokens: 1 }, "cc9-e2e");
});

async function openTouch(page: Page, query = "") {
  await page.locator('nav[aria-label="Main"] a[href="/touch"]').click();
  await page.waitForURL("**/touch");
  if (query) {
    await page.goto(`/touch${query}`); // same screen, with an idle/poll override for the test
  }
  await expect(page.locator(".touch-root")).toBeVisible();
}

// A real left/right drag (pointer events), the touch screen's swipe.
async function swipe(page: Page, dir: "left" | "right") {
  const box = await page.locator(".touch-root").boundingBox();
  if (!box) throw new Error("no touch-root");
  const cy = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  const endX = dir === "left" ? startX - 260 : startX + 260;
  await page.mouse.move(startX, cy);
  await page.mouse.down();
  await page.mouse.move(endX, cy, { steps: 12 });
  await page.mouse.up();
}

test("Josh reaches the touch screen from the menu; it opens on screen 2 with the alert banner (check 2)", async ({ page }) => {
  await signIn(page, "josh");
  await openTouch(page);

  // A build needs Josh (EZ Binder) and the budget hold is on → start on screen 2 with the banner.
  await expect(page.locator(".touch-root")).toHaveAttribute("data-screen", "2");
  const banner = page.getByTestId("touch-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("EZ Binder API: answer questions");
  await expect(banner).toContainText("Build budget: hold on");

  // That build's row is red and shows Needs Josh with its place in the chain.
  const row = page.getByTestId("touch-build-ez-binder");
  await expect(row).toHaveClass(/red/);
  await expect(page.getByTestId("touch-build-state-ez-binder")).toHaveText("Needs Josh");
  await expect(row.locator(".phase")).toHaveText(/^\d+ of \d+$/);

  // Display only: no phone lookup on the touch screen (spec §3).
  await expect(page.getByText("Phone lookup")).toHaveCount(0);
});

test("swipe works both ways and the toggle switches screen 1 data; Christine on screen 2 jumps to screen 1 (checks 1, 3)", async ({ page }) => {
  await signIn(page, "josh");
  await openTouch(page);
  const root = page.locator(".touch-root");
  await expect(root).toHaveAttribute("data-screen", "2");

  // Swipe right → screen 1 (Today).
  await swipe(page, "right");
  await expect(root).toHaveAttribute("data-screen", "1");

  // The toggle switches screen 1's data in place (check 3, first half). Josh shows Open A/R.
  const s1 = page.getByTestId("touch-screen-1");
  await expect(s1.getByTestId("touch-toggle-josh")).toHaveAttribute("aria-pressed", "true");
  await expect(s1.getByText("Open A/R")).toBeVisible();
  await s1.getByTestId("touch-toggle-christine").click();
  await expect(root).toHaveAttribute("data-screen", "1"); // choosing on screen 1 stays on screen 1
  await expect(s1.getByText("Her cards in progress")).toBeVisible();
  await expect(s1.getByText("Open A/R")).toHaveCount(0);

  // Swipe left → screen 2 again (the other direction).
  await swipe(page, "left");
  await expect(root).toHaveAttribute("data-screen", "2");

  // Choosing Christine (or Bishops) on screen 2 jumps to screen 1 (check 3, second half).
  await page.getByTestId("touch-screen-2").getByTestId("touch-toggle-bishops").click();
  await expect(root).toHaveAttribute("data-screen", "1");
  await expect(page.getByTestId("touch-screen-1").getByText("Bishops cards in progress")).toBeVisible();
});

test("the touch screen returns to screen 1 after the idle time (check 1)", async ({ page }) => {
  await signIn(page, "josh");
  // A 2-second idle for the test (Settings sets it in minutes; ?idle overrides in seconds).
  await openTouch(page, "?idle=2&poll=5000");
  const root = page.locator(".touch-root");

  // Opens on screen 2 (alerts active), then returns to screen 1 once idle, untouched.
  await expect(root).toHaveAttribute("data-screen", "2");
  await expect(root).toHaveAttribute("data-screen", "1", { timeout: 6000 });
});

test("Christine also reaches the touch screen from the menu", async ({ page }) => {
  await signIn(page, "christine");
  await openTouch(page);
  await expect(page.getByTestId("touch-banner")).toBeVisible();
});

test("the touch idle time is editable in Settings (handoff §6)", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");
  await expect(page.getByRole("heading", { name: "Touch screen" })).toBeVisible();
  const input = page.getByTestId("touch-idle-input");
  await input.fill("5");
  await page.getByTestId("touch-idle-form").getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("touch-idle-saved")).toBeVisible();
  await expect(input).toHaveValue("5");
});
