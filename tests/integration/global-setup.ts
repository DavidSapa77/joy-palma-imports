import { execSync } from "node:child_process";

import { resetTestDatabase } from "../support/reset-test-db";

import { getTestDatabaseUrl } from "./test-env";

/**
 * Brings the test database up to date with all migrations and empties it
 * before any test runs, so each run starts clean and the database never grows.
 */
export default async function setup(): Promise<void> {
  const url = getTestDatabaseUrl();
  execSync("pnpm exec prisma migrate deploy", {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
  await resetTestDatabase(url);
}
