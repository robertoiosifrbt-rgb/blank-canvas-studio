/**
 * ACHU-098 — Centralised Duplicate Review Classification
 *
 * Single source of truth for whether a duplicate-check status is
 * still unresolved and requires admin action.
 */

/** All known duplicate-check statuses */
export const DUPLICATE_CHECK_STATUSES = [
  'Possible Duplicate',
  'Confirmed Unique',
  'Reviewed — Saved Anyway',
] as const;

export type DuplicateCheckStatus = (typeof DUPLICATE_CHECK_STATUSES)[number];

/** Statuses that still require review / are unresolved */
const UNRESOLVED_STATUSES: ReadonlySet<string> = new Set([
  'Possible Duplicate',
]);

/**
 * Is this duplicate-check status still unresolved and requiring action?
 *
 * Returns `true` only for genuinely unresolved cases.
 * "Reviewed — Saved Anyway" means the admin already reviewed and
 * explicitly chose to keep the payment — it is NOT unresolved.
 */
export function isDuplicateUnresolved(status: string | null | undefined): boolean {
  return UNRESOLVED_STATUSES.has(status ?? '');
}

