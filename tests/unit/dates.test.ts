import { describe, expect, it } from "vitest";

import {
  businessYear,
  formatDate,
  formatDateTime,
  formatTime,
  getPeriodRange,
  getPreviousPeriod,
  PERIOD_PRESETS,
  startOfBusinessDay,
  toBusinessDate,
  type DateRange,
} from "@/lib/dates";

const ACCRA = "Africa/Accra"; // UTC+0, no DST
const LAGOS = "Africa/Lagos"; // UTC+1, no DST — proves conversion actually happens
const LONDON = "Europe/London"; // has DST — proves calendar math survives clock changes

const utc = (iso: string) => new Date(iso);
const iso = (range: DateRange) => ({
  start: range.start.toISOString(),
  end: range.end.toISOString(),
});

describe("toBusinessDate / startOfBusinessDay", () => {
  it("reads the calendar date in the business time zone", () => {
    const instant = utc("2026-11-30T23:30:00Z");
    expect(toBusinessDate(instant, ACCRA)).toEqual({ year: 2026, month: 11, day: 30 });
    expect(toBusinessDate(instant, LAGOS)).toEqual({ year: 2026, month: 12, day: 1 });
  });

  it("gives the UTC instant of local midnight", () => {
    const day = { year: 2026, month: 12, day: 1 };
    expect(startOfBusinessDay(day, ACCRA).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(startOfBusinessDay(day, LAGOS).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });

  it("defaults to Africa/Accra", () => {
    expect(toBusinessDate(utc("2026-01-01T00:00:00Z"))).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it("decides the year of a New Year's Eve sale by business time", () => {
    const lateNight = utc("2026-12-31T23:30:00Z");
    expect(businessYear(lateNight, ACCRA)).toBe(2026);
    expect(businessYear(lateNight, LAGOS)).toBe(2027);
  });
});

describe("getPeriodRange in Africa/Accra", () => {
  // Thursday 26 Nov 2026, 10:00 in Accra
  const now = utc("2026-11-26T10:00:00Z");
  const range = (preset: Parameters<typeof getPeriodRange>[0], extra = {}) =>
    iso(getPeriodRange(preset, ACCRA, { now, ...extra }));

  it.each([
    ["today", "2026-11-26T00:00:00.000Z", "2026-11-27T00:00:00.000Z"],
    ["yesterday", "2026-11-25T00:00:00.000Z", "2026-11-26T00:00:00.000Z"],
    ["thisWeek", "2026-11-23T00:00:00.000Z", "2026-11-30T00:00:00.000Z"], // Mon–Sun
    ["lastWeek", "2026-11-16T00:00:00.000Z", "2026-11-23T00:00:00.000Z"],
    ["thisMonth", "2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
    ["lastMonth", "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"],
    ["thisQuarter", "2026-10-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"],
    ["thisYear", "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"],
    ["last12Months", "2025-12-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"],
  ] as const)("%s", (preset, start, end) => {
    expect(range(preset)).toEqual({ start, end });
  });

  it("supports weeks starting on Sunday", () => {
    expect(range("thisWeek", { weekStartsOn: 0 })).toEqual({
      start: "2026-11-22T00:00:00.000Z",
      end: "2026-11-29T00:00:00.000Z",
    });
  });

  it("custom range includes the whole last day", () => {
    expect(range("custom", { from: "2026-11-01", to: "2026-11-15" })).toEqual({
      start: "2026-11-01T00:00:00.000Z",
      end: "2026-11-16T00:00:00.000Z",
    });
    expect(range("custom", { from: "2026-11-15", to: "2026-11-15" })).toEqual({
      start: "2026-11-15T00:00:00.000Z",
      end: "2026-11-16T00:00:00.000Z",
    });
  });

  it.each([
    [{}, /needs both/],
    [{ from: "2026-11-01" }, /needs both/],
    [{ from: "2026-11-15", to: "2026-11-01" }, /on or before/],
    [{ from: "2026-02-30", to: "2026-03-01" }, /Invalid date/],
    [{ from: "1/11/2026", to: "2026-11-15" }, /Expected a date/],
  ])("custom range rejects %j", (extra, message) => {
    expect(() => getPeriodRange("custom", ACCRA, { now, ...extra })).toThrow(message);
  });

  it("every preset returns a non-empty range", () => {
    for (const preset of PERIOD_PRESETS) {
      const r = getPeriodRange(preset, ACCRA, { now, from: "2026-11-01", to: "2026-11-02" });
      expect(r.end.getTime()).toBeGreaterThan(r.start.getTime());
    }
  });
});

describe("month boundaries in Africa/Accra", () => {
  it("a sale at 23:59:59 on the last day belongs to that month", () => {
    const nov = getPeriodRange("thisMonth", ACCRA, { now: utc("2026-11-30T23:59:59Z") });
    const lastSecond = utc("2026-11-30T23:59:59.999Z");
    const midnight = utc("2026-12-01T00:00:00Z");
    expect(lastSecond >= nov.start && lastSecond < nov.end).toBe(true);
    expect(midnight < nov.end).toBe(false); // half-open: midnight is December
  });

  it("midnight on the 1st is the new month", () => {
    expect(iso(getPeriodRange("thisMonth", ACCRA, { now: utc("2026-12-01T00:00:00Z") }))).toEqual({
      start: "2026-12-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });

  it("handles February in leap and non-leap years", () => {
    const feb2028 = getPeriodRange("thisMonth", ACCRA, { now: utc("2028-02-29T12:00:00Z") });
    expect(iso(feb2028).end).toBe("2028-03-01T00:00:00.000Z");
    const feb2027 = getPeriodRange("thisMonth", ACCRA, { now: utc("2027-02-28T12:00:00Z") });
    expect(iso(feb2027).end).toBe("2027-03-01T00:00:00.000Z");
  });

  it("last month in January is December of the previous year", () => {
    expect(iso(getPeriodRange("lastMonth", ACCRA, { now: utc("2027-01-15T09:00:00Z") }))).toEqual({
      start: "2026-12-01T00:00:00.000Z",
      end: "2027-01-01T00:00:00.000Z",
    });
  });

  it("last month from 31 March is all of February (no day overflow)", () => {
    expect(iso(getPeriodRange("lastMonth", ACCRA, { now: utc("2027-03-31T09:00:00Z") }))).toEqual({
      start: "2027-02-01T00:00:00.000Z",
      end: "2027-03-01T00:00:00.000Z",
    });
  });

  it("weeks that cross a month and a year", () => {
    // Fri 1 Jan 2027 → week of Mon 28 Dec 2026
    expect(iso(getPeriodRange("thisWeek", ACCRA, { now: utc("2027-01-01T08:00:00Z") }))).toEqual({
      start: "2026-12-28T00:00:00.000Z",
      end: "2027-01-04T00:00:00.000Z",
    });
  });

  it("yesterday on the 1st is the last day of the previous month", () => {
    expect(iso(getPeriodRange("yesterday", ACCRA, { now: utc("2026-03-01T06:00:00Z") }))).toEqual({
      start: "2026-02-28T00:00:00.000Z",
      end: "2026-03-01T00:00:00.000Z",
    });
  });

  it("quarters", () => {
    const q = (now: string) => iso(getPeriodRange("thisQuarter", ACCRA, { now: utc(now) })).start;
    expect(q("2026-01-01T00:00:00Z")).toBe("2026-01-01T00:00:00.000Z");
    expect(q("2026-03-31T23:59:59Z")).toBe("2026-01-01T00:00:00.000Z");
    expect(q("2026-04-01T00:00:00Z")).toBe("2026-04-01T00:00:00.000Z");
    expect(q("2026-09-15T00:00:00Z")).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("other business time zones", () => {
  it("converts local month boundaries to UTC (Africa/Lagos, UTC+1)", () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Lagos
    const range = getPeriodRange("thisMonth", LAGOS, { now: utc("2026-11-30T23:30:00Z") });
    expect(iso(range)).toEqual({
      start: "2026-11-30T23:00:00.000Z",
      end: "2026-12-31T23:00:00.000Z",
    });
  });

  it("survives DST changes (Europe/London, March 2026)", () => {
    const march = getPeriodRange("thisMonth", LONDON, { now: utc("2026-03-15T12:00:00Z") });
    expect(iso(march)).toEqual({
      start: "2026-03-01T00:00:00.000Z", // GMT
      end: "2026-03-31T23:00:00.000Z", // 1 April 00:00 BST
    });
  });
});

describe("getPreviousPeriod", () => {
  const now = utc("2026-11-26T10:00:00Z");
  const prev = (preset: Parameters<typeof getPeriodRange>[0], extra = {}) =>
    iso(getPreviousPeriod(getPeriodRange(preset, ACCRA, { now, ...extra }), ACCRA));

  it.each([
    ["today", "2026-11-25T00:00:00.000Z", "2026-11-26T00:00:00.000Z"],
    ["yesterday", "2026-11-24T00:00:00.000Z", "2026-11-25T00:00:00.000Z"],
    ["thisWeek", "2026-11-16T00:00:00.000Z", "2026-11-23T00:00:00.000Z"],
    ["lastWeek", "2026-11-09T00:00:00.000Z", "2026-11-16T00:00:00.000Z"],
    ["thisMonth", "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"],
    ["lastMonth", "2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
    ["thisQuarter", "2026-07-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
    ["thisYear", "2025-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
    ["last12Months", "2024-12-01T00:00:00.000Z", "2025-12-01T00:00:00.000Z"],
  ] as const)("%s", (preset, start, end) => {
    expect(prev(preset)).toEqual({ start, end });
  });

  it("previous of March is the whole of February, not 31 days back", () => {
    const march = getPeriodRange("thisMonth", ACCRA, { now: utc("2027-03-10T00:00:00Z") });
    expect(iso(getPreviousPeriod(march, ACCRA))).toEqual({
      start: "2027-02-01T00:00:00.000Z",
      end: "2027-03-01T00:00:00.000Z",
    });
  });

  it("custom day ranges shift back by the same number of days", () => {
    expect(prev("custom", { from: "2026-11-10", to: "2026-11-16" })).toEqual({
      start: "2026-11-03T00:00:00.000Z",
      end: "2026-11-10T00:00:00.000Z",
    });
  });

  it("non-midnight ranges shift back by their duration", () => {
    const range = { start: utc("2026-11-26T08:00:00Z"), end: utc("2026-11-26T10:30:00Z") };
    expect(iso(getPreviousPeriod(range, ACCRA))).toEqual({
      start: "2026-11-26T05:30:00.000Z",
      end: "2026-11-26T08:00:00.000Z",
    });
  });

  it("previous month in a non-UTC zone stays on local month boundaries", () => {
    const dec = getPeriodRange("thisMonth", LAGOS, { now: utc("2026-12-10T12:00:00Z") });
    expect(iso(getPreviousPeriod(dec, LAGOS))).toEqual({
      start: "2026-10-31T23:00:00.000Z",
      end: "2026-11-30T23:00:00.000Z",
    });
  });
});

describe("display formatting", () => {
  const instant = utc("2026-11-22T14:05:00Z");

  it("formats per UI spec §2.6", () => {
    expect(formatDate(instant)).toBe("22 Nov 2026");
    expect(formatTime(instant)).toBe("14:05");
    expect(formatDateTime(instant)).toBe("22 Nov 2026, 14:05");
  });

  it("formats in the business time zone", () => {
    expect(formatTime(instant, LAGOS)).toBe("15:05");
    expect(formatDate(utc("2026-11-22T23:30:00Z"), LAGOS)).toBe("23 Nov 2026");
  });
});
