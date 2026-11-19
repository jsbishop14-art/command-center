import { defineConfig } from "vitest/config";

// Unit tests only. Browser (Playwright) tests live in tests/e2e and run with `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    globals: false,
  },
});
