import type { PaymentMethod } from "@prisma/client";

import { nextReceiptNumber, type TransactionClient } from "@/lib/counters";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";
import { calculateSaleTotals, MoneyCalculationError } from "@/lib/sale-math";

import { InventoryError } from "./errors";
import { applyStockMovement, lockProducts } from "./stock";

export type RecordSaleInput = {
  /** Only product + quantity. Prices and costs are always read from the database. */
  items: { productId: string; quantity: number }[];
  /** Pesewas. Owner/Manager only — enforced by the calling action. */
  discount?: number;
  paymentMethod?: PaymentMethod;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  soldById: string;
  /** Back-dating is Owner/Manager only — enforced by the calling action. */
  soldAt?: Date;
  timeZone?: string;
};

/** Merges repeated products into one line, keeping first-seen order. */
function mergeLines(items: RecordSaleInput["items"]) {
  const merged = new Map<string, number>();
  for (const { productId, quantity } of items) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new InventoryError(
        "INVALID_QUANTITY",
        "Quantity must be a whole number above 0",
        productId,
      );
    }
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

/** DATABASE_MODEL §6.1 — record a sale in the caller's transaction. */
export async function recordSale(tx: TransactionClient, input: RecordSaleInput) {
  const soldAt = input.soldAt ?? new Date();
  const items = mergeLines(input.items);
  if (items.length === 0) throw new InventoryError("INVALID_QUANTITY", "Add at least one product");

  // 1. Lock products; check every line BEFORE writing anything.
  const products = await lockProducts(
    tx,
    items.map((i) => i.productId),
  );
  for (const { productId, quantity } of items) {
    const product = products.get(productId)!;
    if (product.isArchived) {
      throw new InventoryError("PRODUCT_ARCHIVED", `"${product.name}" is archived`, productId);
    }
    if (product.quantityInStock < quantity) {
      throw new InventoryError(
        "INSUFFICIENT_STOCK",
        `Only ${product.quantityInStock} of "${product.name}" in stock`,
        productId,
      );
    }
  }

  // 2. Snapshot price and cost from the locked rows.
  let totals;
  try {
    totals = calculateSaleTotals(
      items.map(({ productId, quantity }) => {
        const product = products.get(productId)!;
        return { quantity, unitPrice: product.sellingPrice, unitCost: product.costPrice };
      }),
      input.discount ?? 0,
    );
  } catch (error) {
    if (error instanceof MoneyCalculationError)
      throw new InventoryError("INVALID_AMOUNT", error.message);
    throw error;
  }

  // 3. Receipt number, sale + lines, stock movements.
  const receiptNumber = await nextReceiptNumber(tx, {
    at: soldAt,
    timeZone: input.timeZone ?? DEFAULT_TIME_ZONE,
  });

  const sale = await tx.sale.create({
    data: {
      receiptNumber,
      soldAt,
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      totalCost: totals.totalCost,
      paymentMethod: input.paymentMethod ?? "CASH",
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      note: input.note?.trim() || null,
      soldById: input.soldById,
      items: {
        create: items.map(({ productId }, i) => {
          const line = totals.lines[i]!;
          return {
            productId,
            productName: products.get(productId)!.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            unitCost: line.unitCost,
            lineTotal: line.lineTotal,
            lineCost: line.lineCost,
          };
        }),
      },
    },
    include: { items: true },
  });

  for (const { productId, quantity } of items) {
    await applyStockMovement(tx, {
      product: products.get(productId)!,
      type: "SALE",
      quantityChange: -quantity,
      referenceId: sale.id,
      userId: input.soldById,
      occurredAt: soldAt,
    });
  }

  return sale;
}

export type VoidSaleInput = {
  saleId: string;
  reason: string;
  voidedById: string;
  voidedAt?: Date;
};

/** DATABASE_MODEL §6.2 — void a sale and return its stock. Owner/Manager only (action). */
export async function voidSale(tx: TransactionClient, input: VoidSaleInput) {
  const reason = input.reason.trim();
  if (!reason) throw new InventoryError("REASON_REQUIRED", "A reason is required to void a sale");
  const voidedAt = input.voidedAt ?? new Date();

  const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT "id", "status" FROM "Sale" WHERE "id" = ${input.saleId} FOR UPDATE`;
  const row = locked[0];
  if (!row) throw new InventoryError("SALE_NOT_FOUND", "Sale not found");
  if (row.status !== "COMPLETED") {
    throw new InventoryError("SALE_ALREADY_VOIDED", "This sale has already been voided");
  }

  const items = await tx.saleItem.findMany({ where: { saleId: input.saleId } });
  const products = await lockProducts(
    tx,
    items.map((i) => i.productId),
  );

  const sale = await tx.sale.update({
    where: { id: input.saleId },
    data: { status: "VOIDED", voidedAt, voidedById: input.voidedById, voidReason: reason },
  });

  for (const item of items) {
    await applyStockMovement(tx, {
      product: products.get(item.productId)!,
      type: "SALE_VOID",
      quantityChange: item.quantity,
      referenceId: sale.id,
      userId: input.voidedById,
      occurredAt: voidedAt,
    });
  }

  return sale;
}
