import {
  Prisma,
  type AdjustmentReason,
  type MovementType,
  type PrismaClient,
} from "@prisma/client";

import type { TransactionClient } from "@/lib/counters";

import { InventoryError } from "./errors";

/**
 * The stock ledger. Product.quantityInStock changes ONLY through
 * applyStockMovement, which updates the cached quantity and writes the
 * matching StockMovement row in the same transaction (DATABASE_MODEL §1.3).
 */

export type LockedProduct = {
  id: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  quantityInStock: number;
  isArchived: boolean;
};

/**
 * `SELECT … FOR UPDATE` on the given products, in id order (a consistent lock
 * order prevents deadlocks between concurrent sales). Rows stay locked until
 * the transaction ends. Throws if any id does not exist.
 */
export async function lockProducts(
  tx: TransactionClient,
  productIds: readonly string[],
): Promise<Map<string, LockedProduct>> {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return new Map();
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT "id", "name", "sellingPrice", "costPrice", "quantityInStock", "isArchived"
    FROM "Product"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id"
    FOR UPDATE`;
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of ids) {
    if (!byId.has(id)) throw new InventoryError("PRODUCT_NOT_FOUND", "Product not found", id);
  }
  return byId;
}

export type StockMovementInput = {
  /** Must have been locked with lockProducts in this transaction. Updated in place. */
  product: LockedProduct;
  type: MovementType;
  quantityChange: number;
  referenceId: string;
  userId: string;
  occurredAt: Date;
};

/** Applies one movement to a locked product. Returns the new balance. */
export async function applyStockMovement(
  tx: TransactionClient,
  { product, type, quantityChange, referenceId, userId, occurredAt }: StockMovementInput,
): Promise<number> {
  if (!Number.isSafeInteger(quantityChange) || quantityChange === 0) {
    throw new InventoryError("INVALID_QUANTITY", "Quantity change must be a non-zero whole number");
  }
  const balanceAfter = product.quantityInStock + quantityChange;
  if (balanceAfter < 0) {
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      `Only ${product.quantityInStock} of "${product.name}" in stock`,
      product.id,
    );
  }
  await tx.product.update({
    where: { id: product.id },
    data: { quantityInStock: balanceAfter },
  });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      type,
      quantityChange,
      balanceAfter,
      referenceId,
      userId,
      occurredAt,
    },
  });
  product.quantityInStock = balanceAfter;
  return balanceAfter;
}

export type AdjustStockInput = {
  productId: string;
  quantityChange: number;
  reason: AdjustmentReason;
  note?: string | null;
  adjustedById: string;
  adjustedAt?: Date;
};

/** DATABASE_MODEL §6.4 — manual adjustment (damage, loss, recount…). */
export async function adjustStock(tx: TransactionClient, input: AdjustStockInput) {
  const note = input.note?.trim() || null;
  if (input.reason === "OTHER" && !note) {
    throw new InventoryError("NOTE_REQUIRED", 'A note is required when the reason is "Other"');
  }
  const adjustedAt = input.adjustedAt ?? new Date();
  const product = (await lockProducts(tx, [input.productId])).get(input.productId)!;
  if (product.quantityInStock + input.quantityChange < 0) {
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      `Cannot remove ${-input.quantityChange}: only ${product.quantityInStock} in stock`,
      product.id,
    );
  }
  const adjustment = await tx.stockAdjustment.create({
    data: {
      productId: product.id,
      quantityChange: input.quantityChange,
      reason: input.reason,
      note,
      adjustedById: input.adjustedById,
      adjustedAt,
    },
  });
  await applyStockMovement(tx, {
    product,
    type: "ADJUSTMENT",
    quantityChange: input.quantityChange,
    referenceId: adjustment.id,
    userId: input.adjustedById,
    occurredAt: adjustedAt,
  });
  return adjustment;
}

export type StockMismatch = {
  productId: string;
  name: string;
  quantityInStock: number;
  ledgerTotal: number;
};

/** Products whose cached quantity differs from the sum of their movements. Empty = healthy. */
export async function findStockMismatches(
  db: PrismaClient | TransactionClient,
): Promise<StockMismatch[]> {
  const rows = await db.$queryRaw<StockMismatch[]>`
    SELECT p."id" AS "productId", p."name", p."quantityInStock",
           COALESCE(SUM(m."quantityChange"), 0)::int AS "ledgerTotal"
    FROM "Product" p
    LEFT JOIN "StockMovement" m ON m."productId" = p."id"
    GROUP BY p."id"
    HAVING p."quantityInStock" <> COALESCE(SUM(m."quantityChange"), 0)
    ORDER BY p."name"`;
  return rows;
}
