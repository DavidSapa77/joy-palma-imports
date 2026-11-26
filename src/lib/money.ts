/**
 * Money helpers. All money in the app is an integer number of pesewas
 * (₵1.00 = 100 pesewas). Convert only at the UI edge with these helpers.
 *
 * Parsing works on the decimal digits as text, so no value is ever produced
 * by float multiplication (e.g. 1.005 * 100 === 100.49999999999999).
 */

/** Largest value a PostgreSQL `integer` column can hold (₵21,474,836.47). */
export const MAX_PESEWAS = 2_147_483_647;

export const DEFAULT_CURRENCY_SYMBOL = "₵";

// Optional sign, optional ₵/GHS prefix, then either plain digits or
// correctly grouped thousands ("1,250,000"), then optional decimals.
const MONEY_PATTERN = /^(-)?\s*(?:₵|GH₵|GHS)?\s*(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d*))?$/i;

type ParsedDecimal = { negative: boolean; whole: string; fraction: string };

function parseDecimalText(input: string): ParsedDecimal | null {
  const match = MONEY_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, sign, wholeRaw, fractionRaw] = match;
  if (wholeRaw === undefined && !fractionRaw) return null; // "", ".", "₵"
  return {
    negative: sign === "-",
    whole: (wholeRaw ?? "0").replace(/,/g, ""),
    fraction: fractionRaw ?? "",
  };
}

/** Rounds a decimal (as text) to whole pesewas, half away from zero. */
function decimalToPesewas({ negative, whole, fraction }: ParsedDecimal): number {
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  const roundUp = fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0;
  const magnitude = cents + roundUp;
  return negative && magnitude !== 0 ? -magnitude : magnitude;
}

function assertSafe(pesewas: number, original: unknown): number {
  if (!Number.isSafeInteger(pesewas)) {
    throw new RangeError(`Money value out of range: ${String(original)}`);
  }
  return pesewas;
}

/**
 * Converts a cedi amount to integer pesewas.
 * - number: rounded to the nearest pesewa (half away from zero), e.g. 12.5 → 1250
 * - string: anything `parseMoneyInput` understands, plus a leading "-"
 * Throws on invalid input.
 */
export function toPesewas(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new RangeError(`Invalid money value: ${input}`);
    // String(n) gives the shortest text that round-trips, e.g. "1.005", "0.30000000000000004".
    const text = String(input);
    if (/e/i.test(text)) {
      // Exponent form: tiny values round to 0, huge ones are out of range.
      if (Math.abs(input) < 1) return 0;
      throw new RangeError(`Money value out of range: ${input}`);
    }
    const parsed = parseDecimalText(text);
    if (!parsed) throw new RangeError(`Invalid money value: ${input}`);
    return assertSafe(decimalToPesewas(parsed), input);
  }

  const parsed = parseDecimalText(input);
  if (!parsed || parsed.fraction.length > 2) {
    throw new RangeError(`Invalid money value: "${input}"`);
  }
  return assertSafe(decimalToPesewas(parsed), input);
}

/** Converts pesewas to a cedi number, for charts and display only. Never store the result. */
export function fromPesewas(pesewas: number): number {
  if (!Number.isSafeInteger(pesewas)) {
    throw new RangeError(`Pesewas must be an integer: ${pesewas}`);
  }
  return pesewas / 100;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export type FormatMoneyOptions = {
  /** Currency symbol from Settings. Default "₵". */
  symbol?: string;
};

/** Formats pesewas for display: 125000 → "₵1,250.00", -550 → "-₵5.50". */
export function formatMoney(pesewas: number, options: FormatMoneyOptions = {}): string {
  if (!Number.isSafeInteger(pesewas)) {
    throw new RangeError(`Pesewas must be an integer: ${pesewas}`);
  }
  const symbol = options.symbol ?? DEFAULT_CURRENCY_SYMBOL;
  const abs = Math.abs(pesewas);
  const cedis = groupThousands(String(Math.floor(abs / 100)));
  const fraction = String(abs % 100).padStart(2, "0");
  return `${pesewas < 0 ? "-" : ""}${symbol}${cedis}.${fraction}`;
}

/**
 * Parses what a user typed into a money field: "1250", "1,250.50", "₵12.5", ".50".
 * Returns pesewas, or null if the text is not a valid non-negative amount with
 * at most 2 decimal places that fits in the database.
 */
export function parseMoneyInput(input: string): number | null {
  const parsed = parseDecimalText(input);
  if (!parsed || parsed.negative || parsed.fraction.length > 2) return null;
  const pesewas = decimalToPesewas(parsed);
  return Number.isSafeInteger(pesewas) && pesewas <= MAX_PESEWAS ? pesewas : null;
}
