import { nextStockInRef, type TransactionClient } from "@/lib/counters";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";
import { calculateStockInLine, MoneyCalculationError } from "@/lib/sale-math";

import { InventoryError } from "./errors";
import { applyStockMovement, lockProducts } from "./stock";

export type ReceiveStockInput = {
  items: { productId: string; quantity: number; unitCost: number }[];
  /** Also set Product.costPrice to the new unit cost (recorded in PriceHistory). */
  updateCostPrice: boolean;
  receivedById: string;
  receivedAt?: Date;
  supplier?: string | null;
  note?: string | null;
  timeZone?: string;
};

/** DATABASE_MODEL §6.3 — record a shipment received. */
export async function receiveStock(tx: TransactionClient, input: ReceiveStockInput) {
  const receivedAt = input.receivedAt ?? new Date();
  let lines;
  try {
    lines = input.items.map((item) => ({
      productId: item.productId,
      ...calculateStockInLine(item),
    }));
  } catch (error) {
    if (error instanceof MoneyCalculationError) {
      throw new InventoryError("INVALID_QUANTITY", error.message);
    }
    throw error;
  }
  if (lines.length === 0) {
    throw new InventoryError("INVALID_QUANTITY", "A stock-in needs at least one line");
  }

  const products = await lockProducts(
    tx,
    lines.map((l) => l.productId),
  );
  const reference = await nextStockInRef(tx, {
    at: receivedAt,
    timeZone: input.timeZone ?? DEFAULT_TIME_ZONE,
  });

  const stockIn = await tx.stockIn.create({
    data: {
      reference,
      receivedAt,
      supplier: input.supplier?.trim() || null,
      note: input.note?.trim() || null,
      totalCost: lines.reduce((sum, l) => sum + l.lineCost, 0),
      receivedById: input.receivedById,
      items: {
        create: lines.map(({ productId, quantity, unitCost, lineCost }) => ({
          productId,
          quantity,
          unitCost,
          lineCost,
        })),
      },
    },
  });

  for (const line of lines) {
    const product = products.get(line.productId)!;
    await applyStockMovement(tx, {
      product,
      type: "STOCK_IN",
      quantityChange: line.quantity,
      referenceId: stockIn.id,
      userId: input.receivedById,
      occurredAt: receivedAt,
    });

    if (input.updateCostPrice && product.costPrice !== line.unitCost) {
      await tx.priceHistory.create({
        data: {
          productId: product.id,
          oldSellingPrice: product.sellingPrice,
          newSellingPrice: product.sellingPrice,
          oldCostPrice: product.costPrice,
          newCostPrice: line.unitCost,
          changedById: input.receivedById,
          changedAt: receivedAt,
          note: `Cost updated from stock-in ${reference}`,
        },
      });
      await tx.product.update({ where: { id: product.id }, data: { costPrice: line.unitCost } });
      product.costPrice = line.unitCost;
    }
  }

  return stockIn;
}
