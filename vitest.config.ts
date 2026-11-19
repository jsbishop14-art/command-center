import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests only. Browser (Playwright) tests live in tests/e2e and run with `npm run test:e2e`.
// `server-only` is a Next.js build-time guard with no runtime; stub it so server modules can be
// unit-tested under Node. `@/` matches the tsconfig path alias.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/unit/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    globals: false,
  },
});
