/**
 * ACHU-058 — Shared optimistic concurrency helper.
 *
 * Computes a deterministic revision string from a record's material fields.
 * The same field list is used by both frontend (when the dialog opens) and
 * backend (right before writing) so that any field change is detected.
 *
 * No database-schema changes required — the revision is derived from field
 * values rather than a stored version counter.
 */

/** Compute a deterministic revision string from the given record fields. */
export function computeRevision(
  record: Record<string, any>,
  fields: readonly string[],
): string {
  const parts: string[] = [];
  for (const f of [...fields].sort()) {
    let v = record[f];
    // Normalise linked-record arrays to their first element
    if (Array.isArray(v)) v = v[0];
    parts.push(String(v ?? ''));
  }
  return parts.join('|');
}

/** Per-entity field lists used for revision computation. */
export const REVISION_FIELDS = {
  customer: [
    'customerName', 'phone', 'email', 'address', 'postcode',
    'customerType', 'status', 'notes',
  ] as const,
  job: [
    'customer', 'jobDate', 'service', 'address', 'startTime', 'finishTime',
    'status', 'amountCharged', 'customerInstructions', 'adminNotes',
    'cleanerCompletionNotes', 'quoteNumber',
  ] as const,
  payment: [
    'job', 'paymentDate', 'amount', 'paymentMethod', 'paymentProvider',
    'paymentStatus', 'externalReference', 'notes', 'voidStatus',
  ] as const,
  expense: [
    'expenseDate', 'supplier', 'category', 'description', 'amount',
    'paymentMethod', 'paidBy', 'linkedJob', 'notes', 'voidStatus',
    'documentType', 'documentNumber', 'subtotal', 'vatAmount', 'currency',
    'manuallyReviewed',
  ] as const,
  cleaner: [
    'cleanerName', 'phone', 'email', 'active', 'notes',
  ] as const,
  userAccount: [
    'email', 'firstName', 'lastName', 'role', 'customer', 'cleaner', 'active',
  ] as const,
  financialSettings: [
    'taxReserve', 'nationalInsuranceReserve', 'emergencyReserve',
    'taxYearStart', 'taxYearEnd', 'taxYearMode', 'active', 'notes',
  ] as const,
  quoteRequest: [
    'fullName', 'email', 'phone', 'address', 'postcode',
    'customerType', 'services', 'preferredDate', 'preferredTime',
    'propertyDetails', 'additionalNotes', 'serviceDetails', 'status',
  ] as const,
} as const;

export type RevisionEntity = keyof typeof REVISION_FIELDS;

/**
 * Check whether a supplied revision is valid for an update.
 * Returns 'ok', 'missing' (no revision supplied), or 'stale' (mismatch).
 */
export function checkRevision(
  revision: string | undefined,
  existing: Record<string, any>,
  fields: readonly string[],
): 'ok' | 'missing' | 'stale' {
  if (!revision) return 'missing';
  const current = computeRevision(existing, fields);
  return current === revision ? 'ok' : 'stale';
}
