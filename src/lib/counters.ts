import type { Prisma } from "@prisma/client";

import { businessYear, DEFAULT_TIME_ZONE } from "@/lib/dates";

/**
 * Human-friendly sequential numbers (receipts, stock-in references, SKUs),
 * backed by the `Counter` table.
 *
 * `nextNumber` is a single atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
 * The counter row stays locked until the surrounding transaction commits, so
 * concurrent transactions on the same key wait for each other and can never
 * receive the same number. If the transaction rolls back, the increment rolls
 * back with it — no gaps from failed sales.
 *
 * Always call these inside `prisma.$transaction`, and as late as possible in
 * it, to keep the lock short.
 */

export type TransactionClient = Prisma.TransactionClient;

export async function nextNumber(tx: TransactionClient, key: string): Promise<number> {
  if (key.trim() === "") throw new RangeError("Counter key must not be empty");
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  const value = rows[0]?.value;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Counter "${key}" returned an invalid value`);
  }
  return value;
}

// --- Formatting (pure, unit-tested) -----------------------------------------

/** R-2026-000001 */
export function formatReceiptNumber(year: number, sequence: number): string {
  return `R-${year}-${String(sequence).padStart(6, "0")}`;
}

/** SI-2026-0001 */
export function formatStockInRef(year: number, sequence: number): string {
  return `SI-${year}-${String(sequence).padStart(4, "0")}`;
}

/** JPI-00001 */
export function formatSku(sequence: number): string {
  return `JPI-${String(sequence).padStart(5, "0")}`;
}

// --- Allocation helpers ---------------------------------------------------------

export type YearlyCounterOptions = {
  /** The instant the record belongs to (e.g. soldAt). Defaults to now. */
  at?: Date;
  /** Business time zone; decides which year a late-night sale belongs to. */
  timeZone?: string;
};

/** Receipt numbers restart each business year: key `receipt:YYYY`. */
export async function nextReceiptNumber(
  tx: TransactionClient,
  { at = new Date(), timeZone = DEFAULT_TIME_ZONE }: YearlyCounterOptions = {},
): Promise<string> {
  const year = businessYear(at, timeZone);
  return formatReceiptNumber(year, await nextNumber(tx, `receipt:${year}`));
}

/** Stock-in references restart each business year: key `stockin:YYYY`. */
export async function nextStockInRef(
  tx: TransactionClient,
  { at = new Date(), timeZone = DEFAULT_TIME_ZONE }: YearlyCounterOptions = {},
): Promise<string> {
  const year = businessYear(at, timeZone);
  return formatStockInRef(year, await nextNumber(tx, `stockin:${year}`));
}

/** SKUs never restart: key `sku`. */
export async function nextSku(tx: TransactionClient): Promise<string> {
  return formatSku(await nextNumber(tx, "sku"));
}
