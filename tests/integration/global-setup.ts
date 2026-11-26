import { execSync } from "node:child_process";

import { getTestDatabaseUrl } from "./test-env";

/** Brings the test database up to date with all migrations before any test runs. */
export default function setup(): void {
  const url = getTestDatabaseUrl();
  execSync("pnpm exec prisma migrate deploy", {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
