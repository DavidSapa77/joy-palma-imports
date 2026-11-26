import { existsSync } from "node:fs";

/**
 * Loads .env (if present; CI sets variables directly) and returns the test
 * database URL. Refuses to run against anything that isn't clearly a test
 * database, so integration tests can never touch dev or production data.
 */
export function getTestDatabaseUrl(): string {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Add it to .env (see .env.example).");
  }
  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!databaseName.includes("test")) {
    throw new Error(
      `Refusing to run integration tests: database "${databaseName}" does not look like a test database.`,
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("Refusing to run integration tests: TEST_DATABASE_URL equals DATABASE_URL.");
  }
  return url;
}
