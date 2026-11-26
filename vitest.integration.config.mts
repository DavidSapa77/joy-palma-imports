import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against a real PostgreSQL database (TEST_DATABASE_URL).
// Run with: pnpm test:integration
export default defineConfig({
  // tsconfig keeps JSX for Next.js; tests compile it with the automatic runtime.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false, // test files share one database
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
