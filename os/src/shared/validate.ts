/** Small type guards used by the per-feature recovery functions in `storage.ts`. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** A number we are willing to keep: real, finite, not NaN. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** `YYYY-MM-DD`, and an actual day on the calendar (rejects 2026-02-31). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth
}

/** Strings only, used for optional free-text fields that must not be objects. */
export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}
