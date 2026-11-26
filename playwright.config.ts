import { defineConfig } from "@playwright/test";

import { getTestDatabaseUrl } from "./tests/integration/test-env";

/**
 * End-to-end tests (pnpm test:e2e). Builds and starts a production server on
 * port 3100 (in .next-e2e, separate from `pnpm dev`) against the TEST
 * database, never the dev database, and runs every test at phone width
 * (360px) and desktop width (1280px).
 */
const testDatabaseUrl = getTestDatabaseUrl();
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 }, // bcrypt is deliberately slow
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-360",
      use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl, NEXT_DIST_DIR: ".next-e2e" },
  },
});
