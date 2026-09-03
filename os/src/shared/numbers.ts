/**
 * Bounds for the numbers the user types.
 *
 * The point is to refuse the impossible (negative body weight, 400% body fat,
 * negative reps, `NaN`, `Infinity`) without getting in the way of unusual but
 * real values — so the ranges are deliberately generous.
 */
export interface Bounds {
  min: number
  max: number
}

export type ParsedNumber = { ok: true; value: number } | { ok: false; error: string }

export function parseBounded(raw: string, label: string, bounds: Bounds): ParsedNumber {
  const trimmed = raw.trim()
  // `Number('')` and `Number(' ')` are both 0, which would sneak an empty
  // field through as a real zero.
  if (trimmed === '') return { ok: false, error: `${label} is empty.` }

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, error: `${label} must be a number.` }
  if (value < bounds.min || value > bounds.max) {
    return { ok: false, error: `${label} must be between ${bounds.min} and ${bounds.max}.` }
  }
  return { ok: true, value }
}

/** Keeps a stored number only if it is finite and inside its bounds. */
export function withinBounds(value: unknown, bounds: Bounds): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= bounds.min && value <= bounds.max
}
