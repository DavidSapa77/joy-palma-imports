import type { UnitOfMeasure } from "@prisma/client";

import { nextSku, type TransactionClient } from "@/lib/counters";

import { InventoryError } from "./errors";
import { lockProducts } from "./stock";

function assertPesewas(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InventoryError("INVALID_AMOUNT", `${label} must be a whole number of pesewas ≥ 0`);
  }
}

export type CreateProductInput = {
  name: string;
  /** Leave empty to auto-generate JPI-00001… */
  sku?: string | null;
  description?: string | null;
  categoryId?: string | null;
  unit?: UnitOfMeasure;
  sellingPrice: number;
  costPrice?: number;
  lowStockThreshold?: number | null;
  imageUrl?: string | null;
  createdById: string;
};

/** Creates a product with zero stock. Stock arrives only through a stock-in. */
export async function createProduct(tx: TransactionClient, input: CreateProductInput) {
  assertPesewas(input.sellingPrice, "Selling price");
  assertPesewas(input.costPrice ?? 0, "Cost price");
  const sku = input.sku?.trim() || (await nextSku(tx));
  return tx.product.create({
    data: {
      sku,
      name: input.name.trim(),
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      unit: input.unit ?? "PIECE",
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? null,
      imageUrl: input.imageUrl ?? null,
      createdById: input.createdById,
    },
  });
}

export type ChangeSellingPriceInput = {
  productId: string;
  newSellingPrice: number;
  changedById: string;
  note?: string | null;
  changedAt?: Date;
};

/** DATABASE_MODEL §6.5 — Owner-only (enforced by the calling action). */
export async function changeSellingPrice(tx: TransactionClient, input: ChangeSellingPriceInput) {
  assertPesewas(input.newSellingPrice, "Selling price");
  const product = (await lockProducts(tx, [input.productId])).get(input.productId)!;
  const history = await tx.priceHistory.create({
    data: {
      productId: product.id,
      oldSellingPrice: product.sellingPrice,
      newSellingPrice: input.newSellingPrice,
      oldCostPrice: product.costPrice,
      newCostPrice: product.costPrice,
      changedById: input.changedById,
      changedAt: input.changedAt ?? new Date(),
      note: input.note ?? null,
    },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { sellingPrice: input.newSellingPrice },
  });
  product.sellingPrice = input.newSellingPrice;
  return history;
}
