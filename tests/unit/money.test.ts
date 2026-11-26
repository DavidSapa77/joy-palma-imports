import { describe, expect, it } from "vitest";

import { formatMoney, fromPesewas, MAX_PESEWAS, parseMoneyInput, toPesewas } from "@/lib/money";

describe("toPesewas", () => {
  it.each([
    [0, 0],
    [1, 100],
    [12.5, 1250],
    [1250, 125_000],
    [0.01, 1],
    [19.99, 1999],
    [-5.5, -550],
  ])("number %s → %s pesewas", (input, expected) => {
    expect(toPesewas(input)).toBe(expected);
  });

  it("avoids float multiplication errors", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the float problem we are guarding against
    expect(toPesewas(0.1 + 0.2)).toBe(30);
    expect(toPesewas(1.005)).toBe(101); // 1.005 * 100 === 100.49999999999999
    expect(toPesewas(4.35)).toBe(435); // 4.35 * 100 === 434.99999999999994
    expect(toPesewas(1.15)).toBe(115); // 1.15 * 100 === 114.99999999999999
  });

  it("rounds numbers to the nearest pesewa, half away from zero", () => {
    expect(toPesewas(2.344)).toBe(234);
    expect(toPesewas(2.345)).toBe(235);
    expect(toPesewas(-2.345)).toBe(-235);
    expect(toPesewas(0.001)).toBe(0);
    expect(toPesewas(1e-7)).toBe(0);
  });

  it.each([
    ["1250", 125_000],
    ["1,250.50", 125_050],
    ["₵12.5", 1250],
    ["-₵5.50", -550],
    [" 7 ", 700],
  ])("string %j → %s pesewas", (input, expected) => {
    expect(toPesewas(input)).toBe(expected);
  });

  it("returns a plain 0, never -0", () => {
    expect(Object.is(toPesewas(-0), 0)).toBe(true);
    expect(Object.is(toPesewas("-0.00"), 0)).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, 1e21, Number.MAX_SAFE_INTEGER])("throws on %s", (input) => {
    expect(() => toPesewas(input)).toThrow(RangeError);
  });

  it.each(["", "abc", "1.234", "1,25", "12..5"])("throws on string %j", (input) => {
    expect(() => toPesewas(input)).toThrow(RangeError);
  });
});

describe("fromPesewas", () => {
  it("converts to cedis", () => {
    expect(fromPesewas(125_050)).toBe(1250.5);
    expect(fromPesewas(1)).toBe(0.01);
    expect(fromPesewas(-550)).toBe(-5.5);
    expect(fromPesewas(0)).toBe(0);
  });

  it("round-trips with toPesewas", () => {
    for (const p of [0, 1, 99, 100, 1999, 125_050, MAX_PESEWAS]) {
      expect(toPesewas(fromPesewas(p))).toBe(p);
    }
  });

  it("rejects non-integers", () => {
    expect(() => fromPesewas(12.5)).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it.each([
    [125_000, "₵1,250.00"],
    [125_050, "₵1,250.50"],
    [0, "₵0.00"],
    [5, "₵0.05"],
    [99, "₵0.99"],
    [100, "₵1.00"],
    [12_345_678_901, "₵123,456,789.01"],
    [-550, "-₵5.50"],
    [MAX_PESEWAS, "₵21,474,836.47"],
  ])("%s → %s", (pesewas, expected) => {
    expect(formatMoney(pesewas)).toBe(expected);
  });

  it("uses the symbol from settings", () => {
    expect(formatMoney(125_000, { symbol: "GH₵" })).toBe("GH₵1,250.00");
    expect(formatMoney(125_000, { symbol: "" })).toBe("1,250.00");
  });

  it("rejects non-integers", () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
  });
});

describe("parseMoneyInput", () => {
  it.each([
    ["1250", 125_000],
    ["1,250.50", 125_050],
    ["1,250", 125_000],
    ["1,250,000", 125_000_000],
    ["12.5", 1250],
    ["12.", 1200],
    [".50", 50],
    ["0", 0],
    ["₵45", 4500],
    ["GHS 45.00", 4500],
    ["  45.00  ", 4500],
    ["0045", 4500],
  ])("%j → %s", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });

  it.each([
    "",
    " ",
    ".",
    "₵",
    "abc",
    "12a",
    "-5",
    "1.234",
    "1,25",
    "12,50",
    "1,2345",
    ",250",
    "1 250",
    "1e3",
    "12..5",
  ])("rejects %j", (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });

  it("rejects amounts too large for the database", () => {
    expect(parseMoneyInput("21,474,836.47")).toBe(MAX_PESEWAS);
    expect(parseMoneyInput("21,474,836.48")).toBeNull();
    expect(parseMoneyInput("99999999999999999999")).toBeNull();
  });
});
