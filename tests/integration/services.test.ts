import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InventoryError } from "@/server/services/errors";
import { changeSellingPrice, createProduct } from "@/server/services/products";
import { recordSale, voidSale } from "@/server/services/sales";
import { adjustStock, findStockMismatches } from "@/server/services/stock";
import { receiveStock } from "@/server/services/stock-in";

import { getTestDatabaseUrl } from "./test-env";

let prisma: PrismaClient;
let userId: string;
const run = randomUUID().slice(0, 8);

beforeAll(async () => {
  const url = new URL(getTestDatabaseUrl());
  url.searchParams.set("connection_limit", "10");
  prisma = new PrismaClient({ datasourceUrl: url.toString() });
  const user = await prisma.user.create({
    data: {
      name: "Service Test",
      email: `svc-${run}@test.local`,
      passwordHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A product with `stock` units received through a real stock-in. */
async function productWithStock(stock: number, price = 4500, cost = 2800) {
  return prisma.$transaction(async (tx) => {
    const product = await createProduct(tx, {
      name: `Test product ${run} ${randomUUID().slice(0, 4)}`,
      sellingPrice: price,
      costPrice: cost,
      createdById: userId,
    });
    if (stock > 0) {
      await receiveStock(tx, {
        items: [{ productId: product.id, quantity: stock, unitCost: cost }],
        updateCostPrice: false,
        receivedById: userId,
      });
    }
    return product;
  });
}

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).quantityInStock;

const movementsOf = (id: string) =>
  prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { occurredAt: "asc" } });

describe("createProduct", () => {
  it("auto-generates a JPI SKU and starts with zero stock", async () => {
    const product = await productWithStock(0);
    expect(product.sku).toMatch(/^JPI-\d{5,}$/);
    expect(product.quantityInStock).toBe(0);
  });
});

describe("receiveStock", () => {
  it("increases stock, writes STOCK_IN movements and an SI reference", async () => {
    const product = await productWithStock(10);
    expect(await stockOf(product.id)).toBe(10);
    const [movement] = await movementsOf(product.id);
    expect(movement).toMatchObject({ type: "STOCK_IN", quantityChange: 10, balanceAfter: 10 });
    const stockIn = await prisma.stockIn.findUniqueOrThrow({
      where: { id: movement!.referenceId },
      include: { items: true },
    });
    expect(stockIn.reference).toMatch(/^SI-\d{4}-\d{4,}$/);
    expect(stockIn.totalCost).toBe(28_000);
  });

  it("optionally updates cost price and records price history", async () => {
    const product = await productWithStock(5, 4500, 2800);
    await prisma.$transaction((tx) =>
      receiveStock(tx, {
        items: [{ productId: product.id, quantity: 5, unitCost: 3000 }],
        updateCostPrice: true,
        receivedById: userId,
      }),
    );
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).costPrice).toBe(
      3000,
    );
    const history = await prisma.priceHistory.findMany({ where: { productId: product.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      oldCostPrice: 2800,
      newCostPrice: 3000,
      newSellingPrice: 4500,
    });
  });
});

describe("recordSale", () => {
  it("takes price and cost from the database and reduces stock", async () => {
    const product = await productWithStock(10, 4500, 2800);
    const sale = await prisma.$transaction((tx) =>
      recordSale(tx, {
        // Extra fields a malicious client might send are not part of the input type
        // and are ignored at runtime.
        items: [{ productId: product.id, quantity: 3, unitPrice: 1 } as never],
        discount: 500,
        soldById: userId,
      }),
    );
    expect(sale.receiptNumber).toMatch(/^R-\d{4}-\d{6,}$/);
    expect(sale).toMatchObject({ subtotal: 13_500, discount: 500, total: 13_000, totalCost: 8400 });
    expect(sale.items[0]).toMatchObject({ unitPrice: 4500, unitCost: 2800, lineTotal: 13_500 });
    expect(await stockOf(product.id)).toBe(7);
    const movements = await movementsOf(product.id);
    expect(movements.at(-1)).toMatchObject({ type: "SALE", quantityChange: -3, balanceAfter: 7 });
  });

  it("keeps the old price on past sales after a price change", async () => {
    const product = await productWithStock(10, 4500);
    const before = await prisma.$transaction((tx) =>
      recordSale(tx, { items: [{ productId: product.id, quantity: 1 }], soldById: userId }),
    );
    await prisma.$transaction((tx) =>
      changeSellingPrice(tx, { productId: product.id, newSellingPrice: 5000, changedById: userId }),
    );
    const after = await prisma.$transaction((tx) =>
      recordSale(tx, { items: [{ productId: product.id, quantity: 1 }], soldById: userId }),
    );
    expect(before.items[0]!.unitPrice).toBe(4500);
    expect(after.items[0]!.unitPrice).toBe(5000);
    const reloaded = await prisma.saleItem.findFirstOrThrow({ where: { saleId: before.id } });
    expect(reloaded.unitPrice).toBe(4500);
  });

  it("merges repeated lines for the same product", async () => {
    const product = await productWithStock(10);
    const sale = await prisma.$transaction((tx) =>
      recordSale(tx, {
        items: [
          { productId: product.id, quantity: 2 },
          { productId: product.id, quantity: 1 },
        ],
        soldById: userId,
      }),
    );
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]!.quantity).toBe(3);
  });

  it("refuses to oversell and writes nothing", async () => {
    const product = await productWithStock(2);
    const salesBefore = await prisma.sale.count();
    await expect(
      prisma.$transaction((tx) =>
        recordSale(tx, { items: [{ productId: product.id, quantity: 3 }], soldById: userId }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", productId: product.id });
    expect(await stockOf(product.id)).toBe(2);
    expect(await prisma.sale.count()).toBe(salesBefore);
  });

  it("concurrent sales cannot oversell the last units", async () => {
    const product = await productWithStock(3);
    const attempt = () =>
      prisma.$transaction(
        (tx) =>
          recordSale(tx, { items: [{ productId: product.id, quantity: 1 }], soldById: userId }),
        { timeout: 20_000, maxWait: 20_000 },
      );
    const results = await Promise.allSettled(Array.from({ length: 6 }, attempt));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(3);
    expect(await stockOf(product.id)).toBe(0);
  });

  it("rejects archived products, bad quantities and too-large discounts", async () => {
    const product = await productWithStock(5, 1000);
    const sell = (input: Partial<Parameters<typeof recordSale>[1]>) =>
      prisma.$transaction((tx) =>
        recordSale(tx, {
          items: [{ productId: product.id, quantity: 1 }],
          soldById: userId,
          ...input,
        }),
      );
    await expect(sell({ discount: 1001 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(sell({ items: [{ productId: product.id, quantity: 0 }] })).rejects.toMatchObject({
      code: "INVALID_QUANTITY",
    });
    await expect(sell({ items: [{ productId: "missing", quantity: 1 }] })).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
    await prisma.product.update({ where: { id: product.id }, data: { isArchived: true } });
    await expect(sell({})).rejects.toBeInstanceOf(InventoryError);
    expect(await stockOf(product.id)).toBe(5);
  });
});

describe("voidSale", () => {
  it("marks the sale void and returns the stock", async () => {
    const product = await productWithStock(5);
    const sale = await prisma.$transaction((tx) =>
      recordSale(tx, { items: [{ productId: product.id, quantity: 2 }], soldById: userId }),
    );
    const voided = await prisma.$transaction((tx) =>
      voidSale(tx, { saleId: sale.id, reason: "Wrong product", voidedById: userId }),
    );
    expect(voided).toMatchObject({
      status: "VOIDED",
      voidReason: "Wrong product",
      voidedById: userId,
    });
    expect(await stockOf(product.id)).toBe(5);
    expect((await movementsOf(product.id)).at(-1)).toMatchObject({
      type: "SALE_VOID",
      quantityChange: 2,
      balanceAfter: 5,
    });
  });

  it("requires a reason and cannot void twice", async () => {
    const product = await productWithStock(5);
    const sale = await prisma.$transaction((tx) =>
      recordSale(tx, { items: [{ productId: product.id, quantity: 1 }], soldById: userId }),
    );
    await expect(
      prisma.$transaction((tx) =>
        voidSale(tx, { saleId: sale.id, reason: "  ", voidedById: userId }),
      ),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await prisma.$transaction((tx) =>
      voidSale(tx, { saleId: sale.id, reason: "Duplicate", voidedById: userId }),
    );
    await expect(
      prisma.$transaction((tx) =>
        voidSale(tx, { saleId: sale.id, reason: "Again", voidedById: userId }),
      ),
    ).rejects.toMatchObject({ code: "SALE_ALREADY_VOIDED" });
    expect(await stockOf(product.id)).toBe(5);
  });
});

describe("adjustStock", () => {
  it("applies adjustments with a movement", async () => {
    const product = await productWithStock(5);
    await prisma.$transaction((tx) =>
      adjustStock(tx, {
        productId: product.id,
        quantityChange: -2,
        reason: "DAMAGED",
        adjustedById: userId,
      }),
    );
    expect(await stockOf(product.id)).toBe(3);
    expect((await movementsOf(product.id)).at(-1)).toMatchObject({
      type: "ADJUSTMENT",
      balanceAfter: 3,
    });
  });

  it("refuses to go below zero and requires a note for OTHER", async () => {
    const product = await productWithStock(1);
    await expect(
      prisma.$transaction((tx) =>
        adjustStock(tx, {
          productId: product.id,
          quantityChange: -2,
          reason: "LOST",
          adjustedById: userId,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(
      prisma.$transaction((tx) =>
        adjustStock(tx, {
          productId: product.id,
          quantityChange: 1,
          reason: "OTHER",
          adjustedById: userId,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
    expect(await stockOf(product.id)).toBe(1);
  });
});

describe("ledger", () => {
  it("cached stock equals the sum of movements for every product", async () => {
    expect(await findStockMismatches(prisma)).toEqual([]);
  });

  it("detects a cached quantity edited outside the ledger", async () => {
    const product = await productWithStock(4);
    await prisma.product.update({ where: { id: product.id }, data: { quantityInStock: 9 } });
    const mismatches = await findStockMismatches(prisma);
    expect(mismatches).toContainEqual(
      expect.objectContaining({ productId: product.id, quantityInStock: 9, ledgerTotal: 4 }),
    );
    // Put it back so the shared test database stays consistent.
    await prisma.product.update({ where: { id: product.id }, data: { quantityInStock: 4 } });
  });
});
