import { describe, expect, it } from "vitest";

import { formatReceiptNumber, formatSku, formatStockInRef } from "@/lib/counters";

describe("counter number formats", () => {
  it("receipt numbers: R-YYYY-000001", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("R-2026-000001");
    expect(formatReceiptNumber(2026, 123)).toBe("R-2026-000123");
    expect(formatReceiptNumber(2026, 999_999)).toBe("R-2026-999999");
    expect(formatReceiptNumber(2026, 1_000_000)).toBe("R-2026-1000000"); // grows, never truncates
  });

  it("stock-in references: SI-YYYY-0001", () => {
    expect(formatStockInRef(2026, 1)).toBe("SI-2026-0001");
    expect(formatStockInRef(2027, 42)).toBe("SI-2027-0042");
    expect(formatStockInRef(2026, 12_345)).toBe("SI-2026-12345");
  });

  it("SKUs: JPI-00001", () => {
    expect(formatSku(1)).toBe("JPI-00001");
    expect(formatSku(30)).toBe("JPI-00030");
    expect(formatSku(123_456)).toBe("JPI-123456");
  });
});
