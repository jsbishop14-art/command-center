import { test, expect } from "@playwright/test";
import { signIn } from "./util";

// CC3 spec check 4: Refresh makes no Claude call. The authoritative assertion is the unit test
// tests/unit/refresh-no-ai.test.ts (static scan that the feeds code imports no AI client, plus a
// run with none in the path). Here we confirm the button is labelled "no AI", that it runs and
// updates the last-refreshed time, and that the browser makes no request to an AI host.
test("Refresh is labelled no-AI, runs, and makes no AI request", async ({ page }) => {
  await signIn(page, "josh");

  const refresh = page.getByTestId("refresh");
  await expect(refresh).toContainText("no AI");

  const aiRequests: string[] = [];
  page.on("request", (r) => {
    if (/anthropic|claude/i.test(r.url())) aiRequests.push(r.url());
  });

  await refresh.click();
  await expect(refresh).toContainText("just now");
  expect(aiRequests).toEqual([]);
});
