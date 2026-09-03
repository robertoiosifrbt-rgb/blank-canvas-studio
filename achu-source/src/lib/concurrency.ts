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
  record: Record<string, unknown>,
  fields: readonly string[],
): string {
  const parts: string[] = [];
  for (const f of [...fields].sort()) {
    let v = record[f];
    // Normalise linked-record arrays to their first element
    if (Array.isArray(v)) v = v[0];
    // BUGFIX (Sesiunea 20 test suite): mirrors the backend's copy of this
    // file exactly — a real `Date` object stringifies differently than the
    // ISO string the same value becomes over JSON. Harmless here (this
    // file only ever sees already-JSON'd string values), but the two
    // copies must stay byte-for-byte identical or revisions silently stop
    // matching between frontend and backend.
    if (v instanceof Date) v = v.toISOString();
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
    // BUGFIX (Sesiunea 20 test suite): 'customer' was the relation name, not
    // the scalar column returned by GET /jobs (`customerId`) — always read
    // as `undefined`, so a concurrent customer reassignment was silently
    // invisible to the revision check. Same class of bug as
    // payment/expense/userAccount below. Must match the backend's
    // REVISION_FIELDS exactly (backend/src/lib/concurrency.ts) — a mismatch
    // here would make every save look "stale" even when it isn't.
    'customerId', 'jobDate', 'service', 'address', 'startTime', 'finishTime',
    'status', 'amountCharged', 'customerInstructions', 'adminNotes',
    'cleanerCompletionNotes', 'quoteNumber',
  ] as const,
  payment: [
    'jobId', 'paymentDate', 'amount', 'paymentMethod', 'paymentProvider',
    'paymentStatus', 'externalReference', 'notes', 'voidStatus',
  ] as const,
  expense: [
    'expenseDate', 'supplier', 'category', 'description', 'amount',
    'paymentMethod', 'paidBy', 'linkedJobId', 'notes', 'voidStatus',
    'documentType', 'documentNumber', 'subtotal', 'vatAmount', 'currency',
    'manuallyReviewed',
  ] as const,
  cleaner: [
    /** 🆕 §26 (Sesiunea 154) — `teamId` intră în amprentă, ca pe server (`backend/src/lib/concurrency.ts`):
     * cele două liste trebuie să spună **același** lucru, altfel amprenta trimisă nu se potrivește cu
     * cea calculată și fiecare salvare ar arăta ca un conflict. */
    'cleanerName', 'phone', 'email', 'active', 'notes', 'teamId',
  ] as const,
  userAccount: [
    /**
     * 🆕 §3 (Sesiunea 158) — `notes` intră în amprentă, ca la client, curățător, plată și cheltuială.
     *
     * 🔴 **Adăugat pe server și UITAT aici** la prima scriere, iar consecința ar fi fost gravă:
     * amprenta s-ar fi calculat diferit pe ecran și pe server, deci **nicio** salvare de cont n-ar mai
     * fi trecut — cu mesajul „modificat de alt utilizator", care e plauzibil și trimite pe cine caută
     * în cu totul altă direcție. ✅ Prins de `concurrencyFieldParity.test.ts`, în CI, nu de o citire.
     */
    'email', 'firstName', 'lastName', 'role', 'customerId', 'cleanerId', 'active', 'notes',
  ] as const,
  financialSettings: [
    'taxReservePercent', 'nationalInsuranceReservePercent', 'emergencyReservePercent',
    'taxYearStart', 'taxYearEnd', 'taxYearMode', 'active', 'notes',
  ] as const,
  quoteRequest: [
    'fullName', 'email', 'phone', 'address', 'postcode',
    'customerType', 'services', 'preferredDate', 'preferredTime',
    'propertyDetails', 'additionalNotes', 'serviceDetails', 'status',
    // §6 (Sesiunea 158) — evaluarea biroului și hotărârea de a merge să se vadă casa.
    // 🔴 Adăugate ÎN AMÂNDOUĂ listele deodată: pe server singur, amprenta s-ar calcula diferit aici,
    // iar ORICE salvare a unei cereri ar fi fost refuzată cu „modificat de alt utilizator" — un
    // mesaj plauzibil, care trimite pe cine caută în cu totul altă direcție. ⚠️ Aceeași capcană
    // plătită dimineață pe ecranul de conturi; prinsă de `concurrencyFieldParity.test.ts`.
    'internalAssessment', 'siteVisitRequired',
    // §6 (Sesiunea 159) — adăugate ÎN AMÂNDOUĂ listele deodată, ca `internalAssessment` mai sus;
    // `concurrencyFieldParity.test.ts` pică dacă se despart.
    'urgency', 'dateFlexible',
    // §6 (Sesiunea 160) — întrebarea către client, tot în amândouă listele deodată.
    'infoNeededNote',
  ] as const,
} as const;

export type RevisionEntity = keyof typeof REVISION_FIELDS;

/**
 * Check whether a supplied revision is valid for an update.
 * Returns 'ok', 'missing' (no revision supplied), or 'stale' (mismatch).
 */
export function checkRevision(
  revision: string | undefined,
  existing: Record<string, unknown>,
  fields: readonly string[],
): 'ok' | 'missing' | 'stale' {
  if (!revision) return 'missing';
  const current = computeRevision(existing, fields);
  return current === revision ? 'ok' : 'stale';
}

