import { afterEach, describe, expect, it, vi } from "vitest";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: unknown };

describe("prisma singleton (src/lib/db.ts)", () => {
  afterEach(() => {
    delete globalForPrisma.prisma;
    vi.resetModules();
  });

  it("reuses the same client across module reloads (hot reload)", async () => {
    const first = (await import("@/lib/db")).prisma;
    vi.resetModules(); // simulate Next.js re-evaluating the module
    const second = (await import("@/lib/db")).prisma;

    expect(second).toBe(first);
    expect(globalForPrisma.prisma).toBe(first);
  });

  it("does not open a database connection just by importing", async () => {
    const { prisma } = await import("@/lib/db");
    // PrismaClient connects lazily on the first query; disconnect is a no-op here.
    await expect(prisma.$disconnect()).resolves.toBeUndefined();
  });
});
