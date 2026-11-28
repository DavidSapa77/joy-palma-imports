import { PrismaClient } from "@prisma/client";

/**
 * Empties the TEST database before a test run (integration and E2E global
 * setups), so rows created by earlier runs never pile up. Keeps the schema
 * and the migration history; only data is removed.
 *
 * Double-guarded: `url` comes from getTestDatabaseUrl() (which refuses
 * anything that isn't clearly a test database), and the connected database's
 * own name is checked again here before anything is truncated.
 */
export async function resetTestDatabase(url: string): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    const name = rows[0]?.name ?? "";
    if (!name.includes("test")) {
      throw new Error(`Refusing to reset database "${name}": not a test database`);
    }
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
    if (tables.length === 0) return;
    const list = tables.map((t) => `"${t.tablename.replaceAll('"', '""')}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}
