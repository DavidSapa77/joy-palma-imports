import { describe, expect, it } from "vitest";

import { MAX_PESEWAS } from "@/lib/money";
import {
  calculateSaleLine,
  calculateSaleTotals,
  calculateStockInLine,
  calculateStockInTotal,
  MoneyCalculationError,
} from "@/lib/sale-math";

describe("calculateSaleLine", () => {
  it("line total = unit price × quantity; line cost = unit cost × quantity", () => {
    expect(calculateSaleLine({ quantity: 3, unitPrice: 4500, unitCost: 2800 })).toEqual({
      quantity: 3,
      unitPrice: 4500,
      unitCost: 2800,
      lineTotal: 13_500,
      lineCost: 8400,
    });
  });

  it.each([0, -1, 1.5, NaN])("rejects quantity %s", (quantity) => {
    expect(() => calculateSaleLine({ quantity, unitPrice: 100, unitCost: 50 })).toThrow(
      MoneyCalculationError,
    );
  });

  it("rejects fractional or negative money", () => {
    expect(() => calculateSaleLine({ quantity: 1, unitPrice: 12.5, unitCost: 0 })).toThrow();
    expect(() => calculateSaleLine({ quantity: 1, unitPrice: -1, unitCost: 0 })).toThrow();
    expect(() => calculateSaleLine({ quantity: 1, unitPrice: 0, unitCost: -1 })).toThrow();
  });

  it("allows free items (price 0)", () => {
    expect(calculateSaleLine({ quantity: 2, unitPrice: 0, unitCost: 0 }).lineTotal).toBe(0);
  });

  it("rejects totals too large for the database column", () => {
    expect(() => calculateSaleLine({ quantity: 2, unitPrice: MAX_PESEWAS, unitCost: 0 })).toThrow(
      /too large/,
    );
  });
});

describe("calculateSaleTotals", () => {
  const lines = [
    { quantity: 3, unitPrice: 4500, unitCost: 2800 }, // 135.00 / 84.00
    { quantity: 1, unitPrice: 25_000, unitCost: 17_000 }, // 250.00 / 170.00
  ];

  it("sums lines and applies the discount", () => {
    const totals = calculateSaleTotals(lines, 1500);
    expect(totals.subtotal).toBe(38_500);
    expect(totals.discount).toBe(1500);
    expect(totals.total).toBe(37_000);
    expect(totals.totalCost).toBe(25_400);
    expect(totals.lines).toHaveLength(2);
  });

  it("defaults to no discount", () => {
    expect(calculateSaleTotals(lines).total).toBe(38_500);
  });

  it("allows a discount equal to the subtotal", () => {
    expect(calculateSaleTotals(lines, 38_500).total).toBe(0);
  });

  it("rejects a discount above the subtotal", () => {
    expect(() => calculateSaleTotals(lines, 38_501)).toThrow(/Discount cannot be more/);
  });

  it("rejects negative or fractional discounts", () => {
    expect(() => calculateSaleTotals(lines, -100)).toThrow(MoneyCalculationError);
    expect(() => calculateSaleTotals(lines, 10.5)).toThrow(MoneyCalculationError);
  });

  it("rejects an empty sale", () => {
    expect(() => calculateSaleTotals([])).toThrow(/at least one line/);
  });

  it("rejects a subtotal too large for the database column", () => {
    const big = { quantity: 1, unitPrice: MAX_PESEWAS, unitCost: 0 };
    expect(() => calculateSaleTotals([big, big])).toThrow(/too large/);
  });
});

describe("stock-in maths", () => {
  it("line cost = quantity × unit cost", () => {
    expect(calculateStockInLine({ quantity: 40, unitCost: 2250 }).lineCost).toBe(90_000);
  });

  it("total cost = Σ line costs", () => {
    expect(
      calculateStockInTotal([
        { quantity: 40, unitCost: 2250 },
        { quantity: 10, unitCost: 17_000 },
      ]),
    ).toBe(260_000);
  });

  it("rejects empty stock-ins and bad lines", () => {
    expect(() => calculateStockInTotal([])).toThrow();
    expect(() => calculateStockInTotal([{ quantity: 0, unitCost: 100 }])).toThrow();
  });
});
