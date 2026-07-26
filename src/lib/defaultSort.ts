/**
 * ACHU Control Centre — Deterministic Default Sort
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DEVELOPER CONTRACT — All list endpoints MUST use this utility.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * GENERAL RECORD LISTS (newest-first):
 *   records.sort((a, b) => defaultSort(a, b, 'expenseId'))
 *
 * The `idField` parameter is the SDK name of the table's permanent
 * visible autonumber field (e.g. 'customerId', 'jobId', 'paymentId',
 * 'expenseId', 'cleanerId', 'userAccountId', 'jobAssignmentId').
 *
 * Sort priority (all descending for newest-first):
 *   1. createdAt  (falls back to createdDate when createdAt is absent)
 *   2. Visible numeric autonumber ID (permanent — never renumbered)
 *   3. Internal immutable record UUID (`id`) as final deterministic
 *      tie-breaker. This is NEVER exposed in the UI.
 *
 * INTENTIONAL EXCEPTIONS (chronological / schedule-based):
 *   Use `chronologicalSort` for lists that must show nearest/oldest first.
 *   - Cleaner Today:    startTime ascending, then jobId descending
 *   - Cleaner Upcoming: jobDate ascending, startTime ascending, then jobId descending
 *   - Customer Portal Upcoming: jobDate ascending
 *
 *   These still preserve permanent visible IDs — they only change the
 *   primary sort axis from "newest first" to "nearest first".
 *
 * IMPORTANT:
 *   - Visible IDs are permanent stored autonumber values.
 *   - They are NEVER regenerated, reused, or renumbered after editing,
 *     deleting, voiding, restoring, filtering, searching, or sorting.
 *   - Database autonumber generation is NOT controlled by frontend sorting.
 *   - The internal `id` (UUID) is used only as a hidden tie-breaker and
 *     must never appear in any user-facing UI.
 *
 * HOW TO ADD A NEW TABLE:
 *   1. Add a permanent autonumber field to the table (e.g. "Record ID").
 *   2. In the list endpoint, call:
 *        records.sort((a, b) => defaultSort(a, b, 'recordId'))
 *   3. For chronological exceptions, use `chronologicalSort` instead.
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Default newest-first sort for general record lists.
 *
 * Priority: createdAt desc → createdDate desc → visible ID desc → internal id desc
 */
export function defaultSort(a: any, b: any, idField: string): number {
  // 1. createdAt (or createdDate) descending
  const aCreated: string = a.createdAt ?? a.createdDate ?? '';
  const bCreated: string = b.createdAt ?? b.createdDate ?? '';
  if (aCreated && bCreated && aCreated !== bCreated) {
    return bCreated.localeCompare(aCreated);
  }

  // 2. Visible numeric ID descending (permanent autonumber)
  const aId = typeof a[idField] === 'number' ? a[idField] : Number(a[idField]);
  const bId = typeof b[idField] === 'number' ? b[idField] : Number(b[idField]);
  if (!isNaN(aId) && !isNaN(bId) && aId !== bId) return bId - aId;

  // 3. Internal immutable record UUID as final deterministic tie-breaker
  // This value is never exposed in the UI.
  const aUuid: string = a.id ?? '';
  const bUuid: string = b.id ?? '';
  if (aUuid && bUuid && aUuid !== bUuid) return bUuid.localeCompare(aUuid);

  return 0;
}
