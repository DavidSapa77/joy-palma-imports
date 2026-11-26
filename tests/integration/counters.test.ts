import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { nextNumber, nextReceiptNumber, nextSku, nextStockInRef } from "@/lib/counters";

import { getTestDatabaseUrl } from "./test-env";

let prisma: PrismaClient;
// Unique prefix per run so tests never collide with leftovers or each other.
const prefix = `itest:${randomUUID()}`;

beforeAll(() => {
  const url = new URL(getTestDatabaseUrl());
  url.searchParams.set("connection_limit", "25"); // enough connections for real concurrency
  prisma = new PrismaClient({ datasourceUrl: url.toString() });
});

afterAll(async () => {
  await prisma.counter.deleteMany({ where: { key: { startsWith: prefix } } });
  await prisma.$disconnect();
});

const nextInOwnTransaction = (key: string, holdMs = 0) =>
  prisma.$transaction(
    async (tx) => {
      const value = await nextNumber(tx, key);
      // Keep the transaction (and the row lock) open a little, so concurrent
      // callers really overlap instead of running one after another.
      if (holdMs > 0) await tx.$executeRaw`SELECT pg_sleep(${holdMs / 1000})`;
      return value;
    },
    { timeout: 20_000, maxWait: 20_000 },
  );

describe("nextNumber (integration)", () => {
  it("starts at 1 and increments", async () => {
    const key = `${prefix}:sequential`;
    expect(await nextInOwnTransaction(key)).toBe(1);
    expect(await nextInOwnTransaction(key)).toBe(2);
    expect(await nextInOwnTransaction(key)).toBe(3);
  });

  it("two concurrent calls on a brand-new key never get the same number", async () => {
    const key = `${prefix}:pair`;
    const [a, b] = await Promise.all([
      nextInOwnTransaction(key, 200),
      nextInOwnTransaction(key, 200),
    ]);
    expect([a, b].sort()).toEqual([1, 2]);
  });

  it("two concurrent calls on an existing key never get the same number", async () => {
    const key = `${prefix}:existing`;
    await nextInOwnTransaction(key); // 1
    const [a, b] = await Promise.all([
      nextInOwnTransaction(key, 200),
      nextInOwnTransaction(key, 200),
    ]);
    expect([a, b].sort()).toEqual([2, 3]);
  });

  it("20 concurrent calls get 20 distinct, gap-free numbers", async () => {
    const key = `${prefix}:many`;
    const values = await Promise.all(
      Array.from({ length: 20 }, () => nextInOwnTransaction(key, 20)),
    );
    expect(new Set(values).size).toBe(20);
    expect([...values].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("a rolled-back transaction gives its number back", async () => {
    const key = `${prefix}:rollback`;
    expect(await nextInOwnTransaction(key)).toBe(1);
    await expect(
      prisma.$transaction(async (tx) => {
        await nextNumber(tx, key); // would be 2
        throw new Error("sale failed");
      }),
    ).rejects.toThrow("sale failed");
    expect(await nextInOwnTransaction(key)).toBe(2);
  });

  it("keys are independent", async () => {
    expect(await nextInOwnTransaction(`${prefix}:a`)).toBe(1);
    expect(await nextInOwnTransaction(`${prefix}:b`)).toBe(1);
    expect(await nextInOwnTransaction(`${prefix}:a`)).toBe(2);
  });

  it("rejects an empty key", async () => {
    await expect(prisma.$transaction((tx) => nextNumber(tx, " "))).rejects.toThrow(RangeError);
  });
});

describe("number helpers (integration)", () => {
  // These use the real keys, so read the current value first and compare relatively.
  const current = async (key: string) =>
    (await prisma.counter.findUnique({ where: { key } }))?.value ?? 0;

  afterAll(async () => {
    // Real-key counters only exist in the test database; reset so reruns stay predictable.
    await prisma.counter.deleteMany({
      where: { key: { in: ["receipt:2031", "stockin:2031", "receipt:2030", "sku"] } },
    });
  });

  it("nextReceiptNumber uses the business-time-zone year", async () => {
    const at = new Date("2031-06-01T10:00:00Z");
    const before = await current("receipt:2031");
    const receipt = await prisma.$transaction((tx) => nextReceiptNumber(tx, { at }));
    expect(receipt).toBe(`R-2031-${String(before + 1).padStart(6, "0")}`);

    // 23:30 UTC on 31 Dec 2030 is already 2031 in Lagos (UTC+1), still 2030 in Accra.
    const nye = new Date("2030-12-31T23:30:00Z");
    const lagos = await prisma.$transaction((tx) =>
      nextReceiptNumber(tx, { at: nye, timeZone: "Africa/Lagos" }),
    );
    expect(lagos).toMatch(/^R-2031-\d{6}$/);
    const accra = await prisma.$transaction((tx) => nextReceiptNumber(tx, { at: nye }));
    expect(accra).toMatch(/^R-2030-\d{6}$/);
  });

  it("nextStockInRef formats SI-YYYY-NNNN", async () => {
    const before = await current("stockin:2031");
    const ref = await prisma.$transaction((tx) =>
      nextStockInRef(tx, { at: new Date("2031-03-01T00:00:00Z") }),
    );
    expect(ref).toBe(`SI-2031-${String(before + 1).padStart(4, "0")}`);
  });

  it("nextSku formats JPI-NNNNN and concurrent calls are unique", async () => {
    const skus = await Promise.all(
      Array.from({ length: 5 }, () => prisma.$transaction((tx) => nextSku(tx))),
    );
    expect(new Set(skus).size).toBe(5);
    for (const sku of skus) expect(sku).toMatch(/^JPI-\d{5,}$/);
  });
});
