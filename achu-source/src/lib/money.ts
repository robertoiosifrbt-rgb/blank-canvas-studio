/**
 * ACHU-123: Penny-safe monetary arithmetic helpers.
 * Single source of truth for GBP money operations.
 *
 * Strategy: validate inputs have ≤ 2 decimal places at write boundaries;
 * use integer-pence arithmetic for aggregation where precision matters.
 */

/** Check if a number has at most 2 decimal places (valid for GBP amounts) */
export function isValidMoneyAmount(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  return Math.abs(Math.round(n * 100) / 100 - n) < 1e-9;
}

/** Convert a £ amount to integer pence for safe arithmetic */
export function toPence(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert integer pence back to £ (2dp) */
export function fromPence(pence: number): number {
  return Math.round(pence) / 100;
}

/** Format pence as a £ string */
export function penceToPounds(pence: number): string {
  return (Math.round(pence) / 100).toFixed(2);
}

/** Normalise a £ value to exactly 2dp (for write boundaries) */
export function normaliseMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Add two £ amounts using integer pence */
export function addMoney(a: number, b: number): number {
  return fromPence(toPence(a) + toPence(b));
}

/** Subtract two £ amounts using integer pence: a - b */
export function subtractMoney(a: number, b: number): number {
  return fromPence(toPence(a) - toPence(b));
}

/** Sum an array of £ amounts using integer pence */
export function sumMoney(values: number[]): number {
  const totalPence = values.reduce((s, v) => s + toPence(v), 0);
  return fromPence(totalPence);
}

/**
 * Sum an array of records by extracting a numeric field, in integer pence.
 * Returns the total in £. Treats null/undefined as 0.
 */
export function sumMoneyField<T>(records: T[], getter: (r: T) => number | null | undefined): number {
  const totalPence = records.reduce((s, r) => s + toPence(getter(r) ?? 0), 0);
  return fromPence(totalPence);
}

/**
 * Sum records into integer pence directly (for intermediate calculations).
 * Use fromPence() on the result when producing final £ values.
 */
export function sumPence<T>(records: T[], getter: (r: T) => number | null | undefined): number {
  return records.reduce((s, r) => s + toPence(getter(r) ?? 0), 0);
}

/** Apply a percentage to a pence amount. Returns integer pence (rounded). */
export function percentOfPence(pence: number, rate: number): number {
  return Math.round(pence * rate);
}

/** Penny-safe tolerance for comparing money: half a penny */
export const PENNY_TOLERANCE = 0.005;

