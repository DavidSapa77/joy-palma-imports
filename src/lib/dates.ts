import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Business time zone helpers. Timestamps are stored in UTC; periods such as
 * "this month" are calendar periods in the business time zone (Settings,
 * default Africa/Accra), converted to UTC instants for database queries.
 *
 * Every range is half-open: start <= t < end, matching
 * `"soldAt" >= $1 AND "soldAt" < $2` in DATABASE_MODEL §7.
 *
 * Calendar arithmetic is done on plain year/month/day numbers, never on the
 * server's local time, so results don't depend on the machine's time zone.
 */

export const DEFAULT_TIME_ZONE = "Africa/Accra";

export const PERIOD_PRESETS = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "thisYear",
  "last12Months",
  "custom",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/** Half-open UTC range [start, end). */
export type DateRange = { start: Date; end: Date };

/** A calendar date in the business time zone. month is 1–12. */
export type CivilDate = { year: number; month: number; day: number };

export type PeriodOptions = {
  /** Reference instant; defaults to the current time. */
  now?: Date;
  /** 1 = Monday (default), 0 = Sunday. */
  weekStartsOn?: 0 | 1;
  /** Required for "custom": inclusive calendar dates, "yyyy-MM-dd". */
  from?: string;
  to?: string;
};

// ---------------------------------------------------------------------------
// Civil-date arithmetic (time-zone free)
// ---------------------------------------------------------------------------

/** Normalises overflow, e.g. 2026-13-01 → 2027-01-01, 2026-03-00 → 2026-02-28. */
function civil(year: number, month: number, day: number): CivilDate {
  const d = new Date(Date.UTC(year, month - 1, day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addDays(date: CivilDate, days: number): CivilDate {
  return civil(date.year, date.month, date.day + days);
}

function addMonths(date: CivilDate, months: number): CivilDate {
  return civil(date.year, date.month + months, date.day);
}

/** 0 = Sunday … 6 = Saturday. */
function dayOfWeek(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function toIsoDate({ year, month, day }: CivilDate): string {
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function parseIsoDate(text: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new RangeError(`Expected a date like 2026-11-22, got "${text}"`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const normalised = civil(date.year, date.month, date.day);
  if (toIsoDate(normalised) !== text) throw new RangeError(`Invalid date "${text}"`);
  return date;
}

// ---------------------------------------------------------------------------
// Time-zone conversion
// ---------------------------------------------------------------------------

/** The calendar date of `instant` in the business time zone. */
export function toBusinessDate(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): CivilDate {
  const [year, month, day] = formatInTimeZone(instant, timeZone, "yyyy-MM-dd").split("-");
  return { year: Number(year), month: Number(month), day: Number(day) };
}

/** UTC instant of 00:00 on `date` in the business time zone. */
export function startOfBusinessDay(date: CivilDate, timeZone: string = DEFAULT_TIME_ZONE): Date {
  return fromZonedTime(`${toIsoDate(civil(date.year, date.month, date.day))}T00:00:00`, timeZone);
}

/** Business-time-zone year of an instant (used for receipt numbers, etc.). */
export function businessYear(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  return toBusinessDate(instant, timeZone).year;
}

function dayRange(from: CivilDate, toExclusive: CivilDate, timeZone: string): DateRange {
  return {
    start: startOfBusinessDay(from, timeZone),
    end: startOfBusinessDay(toExclusive, timeZone),
  };
}

// ---------------------------------------------------------------------------
// Period presets
// ---------------------------------------------------------------------------

/**
 * UTC range for a period preset in the business time zone.
 * "this…" periods cover the whole calendar period (end = start of the next).
 * "last12Months" is the current month plus the 11 before it.
 * "custom" needs `from` and `to` (inclusive calendar dates).
 */
export function getPeriodRange(
  preset: PeriodPreset,
  timeZone: string = DEFAULT_TIME_ZONE,
  options: PeriodOptions = {},
): DateRange {
  const today = toBusinessDate(options.now ?? new Date(), timeZone);
  const weekStartsOn = options.weekStartsOn ?? 1;
  const monthStart = civil(today.year, today.month, 1);

  switch (preset) {
    case "today":
      return dayRange(today, addDays(today, 1), timeZone);
    case "yesterday":
      return dayRange(addDays(today, -1), today, timeZone);
    case "thisWeek":
    case "lastWeek": {
      const offset = (dayOfWeek(today) - weekStartsOn + 7) % 7;
      const weekStart = addDays(today, -offset - (preset === "lastWeek" ? 7 : 0));
      return dayRange(weekStart, addDays(weekStart, 7), timeZone);
    }
    case "thisMonth":
      return dayRange(monthStart, addMonths(monthStart, 1), timeZone);
    case "lastMonth":
      return dayRange(addMonths(monthStart, -1), monthStart, timeZone);
    case "thisQuarter": {
      const quarterStart = civil(today.year, Math.floor((today.month - 1) / 3) * 3 + 1, 1);
      return dayRange(quarterStart, addMonths(quarterStart, 3), timeZone);
    }
    case "thisYear":
      return dayRange(civil(today.year, 1, 1), civil(today.year + 1, 1, 1), timeZone);
    case "last12Months":
      return dayRange(addMonths(monthStart, -11), addMonths(monthStart, 1), timeZone);
    case "custom": {
      if (!options.from || !options.to) {
        throw new RangeError('A "custom" period needs both from and to dates');
      }
      const from = parseIsoDate(options.from);
      const to = parseIsoDate(options.to);
      if (toIsoDate(from) > toIsoDate(to)) {
        throw new RangeError("The start date must be on or before the end date");
      }
      return dayRange(from, addDays(to, 1), timeZone);
    }
    default: {
      const unknown: never = preset;
      throw new RangeError(`Unknown period preset: ${String(unknown)}`);
    }
  }
}

/**
 * The equivalent period immediately before `range`, for "vs previous period".
 * - Whole calendar months (this month, last 12 months, quarter, year) → the
 *   same number of months before (March → February, Q2 → Q1).
 * - Whole days (today, a week, a custom range) → the same number of days before.
 * - Anything else → the same duration before.
 */
export function getPreviousPeriod(
  range: DateRange,
  timeZone: string = DEFAULT_TIME_ZONE,
): DateRange {
  const start = toBusinessDate(range.start, timeZone);
  const end = toBusinessDate(range.end, timeZone);
  const startsAtMidnight = startOfBusinessDay(start, timeZone).getTime() === range.start.getTime();
  const endsAtMidnight = startOfBusinessDay(end, timeZone).getTime() === range.end.getTime();

  if (startsAtMidnight && endsAtMidnight) {
    if (start.day === 1 && end.day === 1) {
      const months = (end.year - start.year) * 12 + (end.month - start.month);
      return dayRange(addMonths(start, -months), start, timeZone);
    }
    const days = Math.round(
      (Date.UTC(end.year, end.month - 1, end.day) -
        Date.UTC(start.year, start.month - 1, start.day)) /
        86_400_000,
    );
    return dayRange(addDays(start, -days), start, timeZone);
  }

  const duration = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - duration), end: new Date(range.start) };
}

// ---------------------------------------------------------------------------
// Display formatting (UI spec §2.6)
// ---------------------------------------------------------------------------

/** "22 Nov 2026" */
export function formatDate(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, "d MMM yyyy");
}

/** "14:05" */
export function formatTime(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, "HH:mm");
}

/** "22 Nov 2026, 14:05" */
export function formatDateTime(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return formatInTimeZone(instant, timeZone, "d MMM yyyy, HH:mm");
}
