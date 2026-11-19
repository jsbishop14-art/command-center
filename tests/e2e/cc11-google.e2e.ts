import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC11 spec check 1: connect, refresh and disconnect for each calendar, Gmail and the intake
// mailbox against the stub Google, signed in as Josh and as Christine, reached by clicking from
// Settings. "Connect" opens Google's sign-in — the stub consent screen here — which redirects back
// through the OAuth callback, so a click ends with the feed connected. No real Google call is made
// (stub transport). Also check 2: a seeded connection Problem shows on the Problems screen with a
// working Reconnect button.
//
// The status assertions after each click auto-wait through the OAuth redirect chain, so there is no
// need to wait on an intermediate URL.

test("josh: connect, disconnect and reconnect each Google target from Settings", async ({ page }) => {
  await signIn(page, "josh");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");

  // The redirect URI to register in Google is shown.
  await expect(page.getByTestId("google-redirect-uri")).toContainText("/api/auth/google/callback");

  // A calendar: disconnect then reconnect via Google's sign-in (the stub).
  await expect(page.getByTestId("feed-status-josh_work")).toHaveText("connected");
  await page.getByTestId("disconnect-josh_work").click();
  await expect(page.getByTestId("feed-status-josh_work")).toHaveText("not connected");
  await page.getByTestId("connect-josh_work").click();
  await expect(page.getByTestId("feed-status-josh_work")).toHaveText("connected");

  // Gmail (Josh's mailbox).
  await expect(page.getByTestId("gmail-status")).toHaveText("connected");
  await page.getByTestId("gmail-disconnect").click();
  await expect(page.getByTestId("gmail-status")).toHaveText("not connected");
  await page.getByTestId("gmail-connect").click();
  await expect(page.getByTestId("gmail-status")).toHaveText("connected");

  // The intake mailbox (a separate Google account) connects on its own.
  await expect(page.getByTestId("intake-status")).toHaveText("not connected");
  await page.getByTestId("intake-connect").click();
  await expect(page.getByTestId("intake-status")).toHaveText("connected");
  await page.getByTestId("intake-disconnect").click();
  await expect(page.getByTestId("intake-status")).toHaveText("not connected");

  // Refresh still works after reconnecting (no error).
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForURL("**/home");
  await page.getByTestId("refresh").click();
  await expect(page.getByTestId("refresh")).toBeVisible();
});

test("the Google OAuth routes require a signed-in user", async ({ page }) => {
  // Not signed in: the start and callback routes send the browser to sign-in, so no connection can
  // be driven without a session (CLAUDE §7; spec §3).
  await page.goto("/api/auth/google/start?target=gmail");
  await expect(page).toHaveURL(/\/signin/);
  await page.goto("/api/auth/google/callback?code=x&state=y");
  await expect(page).toHaveURL(/\/signin/);
});

test("christine: connects her own calendar from Settings", async ({ page }) => {
  await signIn(page, "christine");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/settings");

  await expect(page.getByTestId("feed-status-christine")).toHaveText("connected");
  await page.getByTestId("disconnect-christine").click();
  await expect(page.getByTestId("feed-status-christine")).toHaveText("not connected");
  await page.getByTestId("connect-christine").click();
  await expect(page.getByTestId("feed-status-christine")).toHaveText("connected");
});

test("josh: a connection Problem shows on the Problems screen with a working Reconnect", async ({ page }) => {
  await signIn(page, "josh");
  // Reach Problems by clicking from the kanban board (no direct URL).
  await page.getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL("**/kanban");
  await page.getByTestId("problems-link").click();
  await page.waitForURL("**/kanban/problems");

  // The seeded expired/revoked connection is listed with a Reconnect button.
  await expect(page.getByTestId("feed-problem-cal:josh_personal")).toBeVisible();
  await page.getByTestId("reconnect-cal:josh_personal").click();

  // Reconnect runs the sign-in flow and returns to Settings; the Problem is cleared.
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL("**/kanban");
  await page.getByTestId("problems-link").click();
  await page.waitForURL("**/kanban/problems");
  await expect(page.getByTestId("feed-problem-cal:josh_personal")).toHaveCount(0);
});
