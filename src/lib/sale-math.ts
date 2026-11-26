import { MAX_PESEWAS } from "@/lib/money";

/**
 * Sale and stock-in arithmetic, in integer pesewas. Prices and costs passed in
 * here must come from the database, never from the browser.
 */

export class MoneyCalculationError extends Error {
  override name = "MoneyCalculationError";
}

function assertQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new MoneyCalculationError(`Quantity must be a whole number above 0, got ${quantity}`);
  }
}

function assertPesewas(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MoneyCalculationError(`${label} must be a whole number of pesewas ≥ 0, got ${value}`);
  }
}

function assertFitsColumn(value: number, label: string): number {
  if (value > MAX_PESEWAS) {
    throw new MoneyCalculationError(`${label} is too large to store (${value} pesewas)`);
  }
  return value;
}

export type SaleLineInput = { quantity: number; unitPrice: number; unitCost: number };
export type SaleLineAmounts = SaleLineInput & { lineTotal: number; lineCost: number };

export function calculateSaleLine({
  quantity,
  unitPrice,
  unitCost,
}: SaleLineInput): SaleLineAmounts {
  assertQuantity(quantity);
  assertPesewas(unitPrice, "Unit price");
  assertPesewas(unitCost, "Unit cost");
  return {
    quantity,
    unitPrice,
    unitCost,
    lineTotal: assertFitsColumn(quantity * unitPrice, "Line total"),
    lineCost: assertFitsColumn(quantity * unitCost, "Line cost"),
  };
}

export type SaleTotals = {
  lines: SaleLineAmounts[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
};

/** subtotal = Σ lineTotal; total = subtotal − discount; totalCost = Σ lineCost. */
export function calculateSaleTotals(lineInputs: SaleLineInput[], discount = 0): SaleTotals {
  if (lineInputs.length === 0) throw new MoneyCalculationError("A sale needs at least one line");
  assertPesewas(discount, "Discount");
  const lines = lineInputs.map(calculateSaleLine);
  const subtotal = assertFitsColumn(
    lines.reduce((sum, l) => sum + l.lineTotal, 0),
    "Subtotal",
  );
  const totalCost = assertFitsColumn(
    lines.reduce((sum, l) => sum + l.lineCost, 0),
    "Total cost",
  );
  if (discount > subtotal) {
    throw new MoneyCalculationError("Discount cannot be more than the subtotal");
  }
  return { lines, subtotal, discount, total: subtotal - discount, totalCost };
}

export type StockInLineInput = { quantity: number; unitCost: number };

export function calculateStockInLine({ quantity, unitCost }: StockInLineInput) {
  assertQuantity(quantity);
  assertPesewas(unitCost, "Unit cost");
  return { quantity, unitCost, lineCost: assertFitsColumn(quantity * unitCost, "Line cost") };
}

export function calculateStockInTotal(lines: StockInLineInput[]): number {
  if (lines.length === 0) throw new MoneyCalculationError("A stock-in needs at least one line");
  return assertFitsColumn(
    lines.map(calculateStockInLine).reduce((sum, l) => sum + l.lineCost, 0),
    "Total cost",
  );
}
