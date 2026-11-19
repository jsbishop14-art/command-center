import { defineConfig, devices } from "@playwright/test";

// Browser tests (handoff 7.5: sign in as each login, reach every screen from the app's own menus).
// A fresh seeded test database is created in globalSetup; the app is started with `next start`.
const PORT = Number(process.env.CC_E2E_PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      CC_DB_PATH: process.env.CC_DB_PATH || ".e2e/cc.db",
      CC_KANBAN_DIR: process.env.CC_KANBAN_DIR || ".e2e/kanban",
      // Keep the updater state file under .e2e so the "Check for updates now" button in Settings
      // writes there, not into the repo's data/ dir (CC12).
      CC_UPDATER_STATE: process.env.CC_UPDATER_STATE || ".e2e/updater-state.json",
      CC_SECRET_KEY:
        process.env.CC_SECRET_KEY ||
        "0000000000000000000000000000000000000000000000000000000000000000",
      NODE_ENV: "production",
    },
  },
});
