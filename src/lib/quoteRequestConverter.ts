/**
 * ACHU-079/088/089/091/092/093/094/095 — Quote Request Conversion Engine
 *
 * Converts eligible Quote Requests into Customers + Jobs + UserAccounts.
 *
 * ACHU-089 CONCURRENCY STATUS: PARTIAL — PLATFORM LIMITATION
 *
 *  The Zite Database platform does NOT provide:
 *    - unique constraints / unique indexes on arbitrary fields
 *    - atomic upsert / ON CONFLICT
 *    - conditional create / compare-and-set
 *    - transactions
 *    - caller-supplied deterministic primary IDs
 *
 *  `bulkCreate({ matchOn })` was empirically verified to be APPLICATION-LEVEL
 *  find-then-create — two concurrent calls with the same matchOn value both
 *  create separate records. It does NOT enforce database-level uniqueness.
 *
 *  Mitigation (strongest available on this platform):
 *    1. Ownership tokens prevent MOST concurrent execution (pre-claim guard)
 *    2. Find-first pattern catches the common sequential duplicate case
 *    3. Post-creation duplicate detection: after EVERY create, immediately
 *       query for duplicates by the canonical key and reconcile
 *    4. Reconciliation selects the oldest record as canonical, deletes
 *       orphan duplicates that have no linked records, and flags
 *       irreconcilable duplicates for manual review
 *    5. Deterministic idempotency tokens enable duplicate Jobs to be detected
 *
 *  This reduces the race window to the gap between create and the post-create
 *  findAll check. It does NOT eliminate it with a database guarantee.
 *
 * Other guarantees preserved:
 *  • Only CONVERSION_ELIGIBLE_STATUSES may convert (ACHU-091)
 *  • Validates QR data using shared helpers — rejects, never truncates (ACHU-092)
 *  • Recovery runs BEFORE eligibility (ACHU-095)
 *  • Returns per-record error information (ACHU-094)
 */
import { QuoteRequests, Customers, Jobs, UserAccounts } from 'zite-integrations-backend-sdk';
import type { CustomersRecordType, UserAccountsRecordType, JobsRecordType } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from './audit';
import { isConversionEligible, isRecoverable, ELIGIBLE_STATUS_LIST } from './quoteRequestEligibility';
import { computeRevision, checkRevision, REVISION_FIELDS } from './concurrency';
import {
  isValidDate, isValidTime, isValidEmail, normalizeEmail,
  normalizePhone, normalizeAddress, normalizeFreeText, normalizeName,
  sanitizeStrict, LIMITS,
  VALID_CUSTOMER_TYPES,
} from './validation';

// ─── Types ─────────────────────────────────────────────────────────

export type ConversionResultItem = {
  quoteRequestId: string;
  displayId: string;
  outcome: 'converted' | 'skipped' | 'failed' | 'resumed';
  reason?: string;
  customerId?: string;
  jobId?: string;
  userAccountId?: string;
};

export type ConversionResult = {
  converted: number;
  skipped: number;
  failed: number;
  remaining: number;
  items: ConversionResultItem[];
  errors: string[];
};

// ─── Helpers ───────────────────────────────────────────────────────

function extractLinkedId(field: string[] | string | undefined | null): string | undefined {
  if (field == null) return undefined;
  if (Array.isArray(field)) return field[0];
  return field || undefined;
}

function generateToken(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Deterministic idempotency token for Jobs created from a QR.
 * Two executions converting the same QR produce the same token,
 * enabling post-creation duplicate detection.
 *
 * NOTE: This token is NOT enforced by a database unique constraint.
 * It is used for application-level duplicate detection only.
 */
function jobIdempotencyToken(qrId: string): string {
  return `qr_conv_${qrId}`;
}

// ─── Shared Validation (ACHU-092) ──────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
  email?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  customerType?: string;
  jobDate?: string;
  startTime?: string;
  service?: string;
  customerInstructions?: string;
  notes?: string;
}

function validateQuoteRequest(qr: any): ValidationResult {
  const errors: string[] = [];

  const rawEmail = qr.email?.trim();
  if (!rawEmail) {
    errors.push('Email is required');
  } else if (!isValidEmail(rawEmail)) {
    errors.push(`Invalid email format: ${rawEmail}`);
  }
  const email = rawEmail ? normalizeEmail(rawEmail) : undefined;

  const customerName = normalizeName(qr.fullName, LIMITS.customerName);
  if (!customerName) {
    const rawName = qr.fullName?.trim();
    if (!rawName) {
      errors.push('Customer name is required');
    } else {
      errors.push(`Customer name exceeds ${LIMITS.customerName} characters`);
    }
  }

  const phone = normalizePhone(qr.phone);

  const rawAddress = normalizeAddress(qr.address);
  if (rawAddress && rawAddress.length > LIMITS.address) {
    errors.push(`Address exceeds ${LIMITS.address} characters`);
  }
  const address = rawAddress && rawAddress.length <= LIMITS.address ? rawAddress : undefined;

  const postcode = qr.postcode?.trim() || undefined;

  const customerType = qr.customerType?.trim() || undefined;
  if (customerType && !VALID_CUSTOMER_TYPES.includes(customerType)) {
    errors.push(`Invalid customer type: ${customerType}. Valid: ${VALID_CUSTOMER_TYPES.join(', ')}`);
  }

  const jobDate = qr.preferredDate?.trim() || undefined;
  if (jobDate && !isValidDate(jobDate)) {
    errors.push(`Invalid preferred date: ${jobDate}`);
  }

  const rawTime = qr.preferredTime?.trim() || undefined;
  let startTime: string | undefined;
  if (rawTime) {
    if (!/^\d{2}:\d{2}$/.test(rawTime)) {
      errors.push(`Invalid preferred time format: "${rawTime}". Must be HH:MM (e.g. 09:00, 14:30)`);
    } else if (!isValidTime(rawTime)) {
      errors.push(`Invalid preferred time value: "${rawTime}". Hours 00-23, minutes 00-59`);
    } else {
      startTime = rawTime;
    }
  }

  const serviceText = Array.isArray(qr.services) && qr.services.length > 0
    ? qr.services.join(', ')
    : undefined;
  if (!serviceText) {
    errors.push('Service is required');
  }
  let service: string | undefined;
  if (serviceText) {
    try {
      service = sanitizeStrict(serviceText, LIMITS.service, 'Service');
    } catch (e: any) {
      errors.push(e.message);
      service = undefined;
    }
  }

  const instrParts: string[] = [];
  if (qr.propertyDetails?.trim()) instrParts.push(qr.propertyDetails.trim());
  if (qr.additionalNotes?.trim()) instrParts.push(qr.additionalNotes.trim());
  const rawInstr = instrParts.length > 0 ? instrParts.join('\n\n') : undefined;
  const customerInstructions = rawInstr ? normalizeFreeText(rawInstr, LIMITS.instructions) : undefined;
  if (rawInstr && !customerInstructions) {
    errors.push(`Customer instructions exceed ${LIMITS.instructions} characters`);
  }

  const rawNotes = qr.serviceDetails?.trim() || undefined;
  const notes = rawNotes ? normalizeFreeText(rawNotes, LIMITS.notes) : undefined;
  if (rawNotes && !notes) {
    errors.push(`Service details exceed ${LIMITS.notes} characters`);
  }

  return {
    valid: errors.length === 0,
    errors,
    email,
    customerName: customerName || undefined,
    phone,
    address,
    postcode,
    customerType: customerType && VALID_CUSTOMER_TYPES.includes(customerType) ? customerType : undefined,
    jobDate: jobDate && isValidDate(jobDate) ? jobDate : undefined,
    startTime,
    service,
    customerInstructions,
    notes,
  };
}

// ─── Ownership Verification (execution control, NOT uniqueness) ───

async function verifyOwnership(qrId: string, token: string): Promise<any | null> {
  const fresh = await QuoteRequests.findOne({ id: qrId });
  if (!fresh || fresh.conversionToken !== token) return null;
  return fresh;
}

// ─── ACHU-058: Protected Write Helpers ────────────────────────────
//
// Every QuoteRequests.update() in the conversion engine goes through
// one of these two helpers. No raw QuoteRequests.update() calls remain.

/**
 * Ownership-guarded QR write — for post-ownership-claim updates.
 * Re-reads the QR and verifies the ownership token still matches
 * before writing. Throws if ownership was lost.
 */
async function ownedQRWrite(
  qrId: string,
  record: Record<string, unknown>,
  ownershipToken: string,
): Promise<void> {
  const fresh = await QuoteRequests.findOne({ id: qrId });
  if (!fresh || fresh.conversionToken !== ownershipToken) {
    throw new Error(`Ownership verification failed for QR ${qrId} — protected write rejected`);
  }
  await QuoteRequests.update({ id: qrId, record });
}

/**
 * Revision-guarded QR write — for pre-ownership updates where no
 * token exists yet (validation errors, ownership claims).
 * Re-reads the QR and verifies the revision hasn't changed since
 * the caller's snapshot.
 */
async function revisionGuardedQRWrite(
  qrId: string,
  record: Record<string, unknown>,
  expectedRevision: string,
): Promise<void> {
  const fresh = await QuoteRequests.findOne({ id: qrId });
  if (!fresh) throw new Error(`QR ${qrId} not found during protected write`);
  const check = checkRevision(expectedRevision, fresh, REVISION_FIELDS.quoteRequest);
  if (check === 'stale') {
    throw new Error('This record has been modified by another user. Reload the latest version before saving.');
  }
  await QuoteRequests.update({ id: qrId, record });
}

// ─── ACHU-089: Find-or-Create with Post-Creation Reconciliation ───
//
// PLATFORM LIMITATION: Zite Database has no unique constraints, atomic
// upsert, or transactions. bulkCreate+matchOn is application-level
// (empirically verified: concurrent calls create duplicates).
//
// Strategy: find-first → create if missing → immediately detect and
// reconcile duplicates by picking the oldest (canonical) record.

/**
 * Find-or-create a Customer by canonical email, with post-creation
 * duplicate detection and reconciliation.
 *
 * Returns { id, created, reconciled }.
 *   created:     true if this execution created a new record
 *   reconciled:  true if duplicates were found and resolved
 */
async function findOrCreateCustomer(
  v: ValidationResult,
  performedBy: string,
  displayId: string,
): Promise<{ id: string; created: boolean; reconciled: boolean }> {
  // Step 1: Find existing
  const existing = await Customers.findOne({ filters: { email: v.email! } });
  if (existing) {
    if (!existing.postcode && v.postcode) {
      await Customers.update({ id: existing.id, record: { postcode: v.postcode } });
    }
    return { id: existing.id, created: false, reconciled: false };
  }

  // Step 2: Create (no database uniqueness — race window exists here)
  const created = await Customers.create({
    record: {
      email: v.email,
      customerName: v.customerName,
      phone: v.phone,
      address: v.address,
      postcode: v.postcode,
      customerType: v.customerType,
      status: 'Lead',
      notes: 'Created automatically from Quote Request',
    },
  });

  // Step 3: Post-creation duplicate detection
  // Immediately check if another concurrent execution also created a Customer
  // with the same email. If so, reconcile to the oldest (canonical) record.
  const { records: allWithEmail } = await Customers.findAll({
    filters: { email: v.email! },
    limit: 20,
  });

  if (allWithEmail.length <= 1) {
    // No duplicates — we are the only record
    return { id: created.id, created: true, reconciled: false };
  }

  // Duplicates found — reconcile: pick oldest as canonical
  const sorted = [...allWithEmail].sort((a, b) =>
    (a.createdDate || '').localeCompare(b.createdDate || '')
  );
  const canonical = sorted[0];
  const duplicates = sorted.slice(1);

  // Delete orphan duplicates that have no linked jobs, payments, or QRs
  for (const dup of duplicates) {
    const hasJobs = dup.jobs && (Array.isArray(dup.jobs) ? dup.jobs.length > 0 : !!dup.jobs);
    const hasPayments = dup.payments && (Array.isArray(dup.payments) ? dup.payments.length > 0 : !!dup.payments);
    const hasQRs = dup.quoteRequests && (Array.isArray(dup.quoteRequests) ? dup.quoteRequests.length > 0 : !!dup.quoteRequests);

    if (!hasJobs && !hasPayments && !hasQRs) {
      try {
        await Customers.delete({ id: dup.id });
        await logAuditSafe({
          entityType: 'Customer', entityId: dup.id, action: 'customer_deleted', performedBy,
          summary: `Duplicate Customer deleted during QR ${displayId} reconciliation. Canonical: ${canonical.id}`,
          metadata: { canonicalId: canonical.id, email: v.email, reason: 'concurrent_duplicate' },
        });
      } catch { /* best-effort — may already be deleted by other execution */ }
    } else {
      // Has linked records — flag for manual review, do not delete
      await logAuditSafe({
        entityType: 'Customer', entityId: dup.id, action: 'quoterequest_duplicate_detected' as any, performedBy,
        summary: `Duplicate Customer ${dup.id} has linked records — manual review required. Canonical: ${canonical.id}`,
        metadata: { canonicalId: canonical.id, email: v.email, hasJobs, hasPayments, hasQRs },
      });
    }
  }

  return { id: canonical.id, created: canonical.id === created.id, reconciled: true };
}

/**
 * Find-or-create a UserAccount by canonical email, with post-creation
 * duplicate detection and reconciliation.
 */
async function findOrCreateUserAccount(
  v: ValidationResult,
  customerId: string,
  performedBy: string,
  displayId: string,
): Promise<{ id: string; record: any; created: boolean; reconciled: boolean }> {
  // Step 1: Find existing
  const existing = await UserAccounts.findOne({ filters: { email: v.email! } });
  if (existing) {
    return { id: existing.id, record: existing, created: false, reconciled: false };
  }

  // Step 2: Create
  const created = await UserAccounts.create({
    record: {
      email: v.email,
      firstName: v.customerName ? v.customerName.split(' ')[0] : undefined,
      lastName: v.customerName && v.customerName.includes(' ')
        ? v.customerName.split(' ').slice(1).join(' ')
        : undefined,
      role: 'Customer',
      customer: customerId,
      active: false,
    },
  });

  // Step 3: Post-creation duplicate detection
  const { records: allWithEmail } = await UserAccounts.findAll({
    filters: { email: v.email! },
    limit: 20,
  });

  if (allWithEmail.length <= 1) {
    return { id: created.id, record: created, created: true, reconciled: false };
  }

  // Reconcile: pick oldest as canonical
  const sorted = [...allWithEmail].sort((a, b) =>
    (a.createdDate || '').localeCompare(b.createdDate || '')
  );
  const canonical = sorted[0];
  const duplicates = sorted.slice(1);

  for (const dup of duplicates) {
    // Only delete if the UA has no customer/cleaner links besides the one we're creating
    const custLink = extractLinkedId(dup.customer);
    const cleanerLink = extractLinkedId(dup.cleaner);
    const safeToDelete = !custLink && !cleanerLink;

    if (safeToDelete || (custLink === customerId && !cleanerLink)) {
      try {
        await UserAccounts.delete({ id: dup.id });
        await logAuditSafe({
          entityType: 'UserAccount', entityId: dup.id, action: 'quoterequest_duplicate_detected' as any, performedBy,
          summary: `Duplicate UserAccount deleted during QR ${displayId} reconciliation. Canonical: ${canonical.id}`,
          metadata: { canonicalId: canonical.id, email: v.email, reason: 'concurrent_duplicate' },
        });
      } catch { /* best-effort */ }
    } else {
      await logAuditSafe({
        entityType: 'UserAccount', entityId: dup.id, action: 'quoterequest_duplicate_detected' as any, performedBy,
        summary: `Duplicate UserAccount ${dup.id} has linked records — manual review required. Canonical: ${canonical.id}`,
        metadata: { canonicalId: canonical.id, email: v.email, custLink, cleanerLink },
      });
    }
  }

  // Re-read canonical to get current state
  const canonicalFull = await UserAccounts.findOne({ id: canonical.id });
  return { id: canonical.id, record: canonicalFull || canonical, created: canonical.id === created.id, reconciled: true };
}

/**
 * Find-or-create a Job by deterministic idempotency token, with
 * post-creation duplicate detection and reconciliation.
 */
async function findOrCreateJob(
  qrId: string,
  customerId: string,
  v: ValidationResult,
  performedBy: string,
  displayId: string,
): Promise<{ id: string; created: boolean; reconciled: boolean }> {
  const token = jobIdempotencyToken(qrId);

  // Step 1: Find existing by deterministic token
  const existing = await Jobs.findOne({ filters: { idempotencyToken: token } });
  if (existing) {
    return { id: existing.id, created: false, reconciled: false };
  }

  // Step 2: Create
  const created = await Jobs.create({
    record: {
      customer: customerId,
      jobDate: v.jobDate || undefined,
      service: v.service,
      address: v.address || undefined,
      startTime: v.startTime || undefined,
      status: 'Enquiry',
      notes: v.notes || undefined,
      customerInstructions: v.customerInstructions || undefined,
      idempotencyToken: token,
    },
  });

  // Step 3: Post-creation duplicate detection
  const { records: allWithToken } = await Jobs.findAll({
    filters: { idempotencyToken: token },
    limit: 20,
  });

  if (allWithToken.length <= 1) {
    return { id: created.id, created: true, reconciled: false };
  }

  // Reconcile: pick oldest as canonical
  const sorted = [...allWithToken].sort((a, b) =>
    (a.createdDate || '').localeCompare(b.createdDate || '')
  );
  const canonical = sorted[0];
  const duplicates = sorted.slice(1);

  for (const dup of duplicates) {
    // Only delete if the Job has no linked payments or assignments
    const hasPayments = dup.payments && (Array.isArray(dup.payments) ? dup.payments.length > 0 : !!dup.payments);
    const hasAssignments = dup.jobAssignments && (Array.isArray(dup.jobAssignments) ? dup.jobAssignments.length > 0 : !!dup.jobAssignments);

    if (!hasPayments && !hasAssignments) {
      try {
        await Jobs.delete({ id: dup.id });
        await logAuditSafe({
          entityType: 'Job', entityId: dup.id, action: 'job_deleted', performedBy,
          summary: `Duplicate Job deleted during QR ${displayId} reconciliation. Canonical: ${canonical.id}. Token: ${token}`,
          metadata: { canonicalId: canonical.id, token, reason: 'concurrent_duplicate' },
        });
      } catch { /* best-effort */ }
    } else {
      await logAuditSafe({
        entityType: 'Job', entityId: dup.id, action: 'quoterequest_duplicate_detected' as any, performedBy,
        summary: `Duplicate Job ${dup.id} has linked records — manual review required. Canonical: ${canonical.id}`,
        metadata: { canonicalId: canonical.id, token, hasPayments, hasAssignments },
      });
    }
  }

  return { id: canonical.id, created: canonical.id === created.id, reconciled: true };
}

// ─── Main Conversion Engine ────────────────────────────────────────

export async function convertEligibleQuoteRequests(performedBy: string): Promise<ConversionResult> {
  const items: ConversionResultItem[] = [];
  const errors: string[] = [];
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  // ACHU-093: Paginate through the full queue
  const PAGE_SIZE = 200;
  let offset = 0;
  const allCandidates: any[] = [];

  while (true) {
    const { records, hasMore } = await QuoteRequests.findAll({
      limit: PAGE_SIZE,
      offset,
    });
    for (const r of records) {
      if (isRecoverable(r.status)) {
        allCandidates.push(r);
      } else if (isConversionEligible(r.status) && !extractLinkedId(r.job)) {
        allCandidates.push(r);
      }
    }
    if (!hasMore) break;
    offset += records.length;
  }

  const totalCandidates = allCandidates.length;
  if (totalCandidates === 0) {
    return { converted, skipped, failed, remaining: 0, items, errors };
  }

  // ACHU-058: Capture revision at scan time for each candidate.
  // Passed to convertSingleQuoteRequest so the fresh load can detect
  // changes that happened between the batch scan and individual processing.
  const revisionMap = new Map<string, string>();
  for (const r of allCandidates) {
    revisionMap.set(r.id, computeRevision(r, REVISION_FIELDS.quoteRequest));
  }

  for (const qrSnapshot of allCandidates) {
    const displayId = qrSnapshot.quoteRequestId != null
      ? `#${qrSnapshot.quoteRequestId}`
      : qrSnapshot.id.slice(0, 8);

    const capturedRevision = revisionMap.get(qrSnapshot.id) ?? '';

    try {
      const result = await convertSingleQuoteRequest(qrSnapshot.id, displayId, performedBy, capturedRevision);
      items.push(result);
      if (result.outcome === 'converted' || result.outcome === 'resumed') converted++;
      else if (result.outcome === 'skipped') skipped++;
      else if (result.outcome === 'failed') {
        failed++;
        errors.push(`QR ${displayId}: ${result.reason}`);
      }
    } catch (e: any) {
      failed++;
      const msg = e?.message || 'Unknown error';
      errors.push(`QR ${displayId}: ${msg}`);
      items.push({ quoteRequestId: qrSnapshot.id, displayId, outcome: 'failed', reason: msg });

      // ACHU-058: Best-effort error recording — revision-guarded.
      // The conversion may have partially modified the QR before throwing, so
      // we re-read, compute current revision, and use revisionGuardedQRWrite.
      try {
        const freshErr = await QuoteRequests.findOne({ id: qrSnapshot.id });
        if (freshErr) {
          const errRev = computeRevision(freshErr, REVISION_FIELDS.quoteRequest);
          await revisionGuardedQRWrite(
            qrSnapshot.id,
            { status: 'Conversion Error', conversionError: msg },
            errRev,
          );
        }
      } catch { /* best-effort */ }

      await logAuditSafe({
        entityType: 'QuoteRequest',
        entityId: qrSnapshot.id,
        action: 'quoterequest_conversion_failed',
        performedBy,
        summary: `Conversion FAILED for Quote Request ${displayId}: ${msg}`,
        metadata: { error: msg },
      });
    }
  }

  return {
    converted,
    skipped,
    failed,
    remaining: totalCandidates - converted - skipped - failed,
    items,
    errors,
  };
}

// ─── Single QR Conversion ──────────────────────────────────────────

async function convertSingleQuoteRequest(
  qrId: string,
  displayId: string,
  performedBy: string,
  capturedRevision: string,
): Promise<ConversionResultItem> {
  const qr = await QuoteRequests.findOne({ id: qrId });
  if (!qr) return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: 'Record not found' };

  // ACHU-058: Shared optimistic concurrency — verify the QR has not been modified
  // since the batch scan captured its revision. This is the entry-point check;
  // subsequent intra-conversion updates are protected by the ownership token.
  const revCheck = checkRevision(capturedRevision, qr, REVISION_FIELDS.quoteRequest);
  if (revCheck === 'stale') {
    return {
      quoteRequestId: qrId, displayId, outcome: 'failed',
      reason: 'This record has been modified by another user. Reload the latest version before saving.',
    };
  }

  // ACHU-095: Recovery path runs FIRST
  if (isRecoverable(qr.status)) {
    return await resumeConversion(qr, displayId, performedBy);
  }

  if (!isConversionEligible(qr.status)) {
    return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: `Status "${qr.status}" is not eligible (need: ${ELIGIBLE_STATUS_LIST})` };
  }

  if (extractLinkedId(qr.job)) {
    return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: 'Already has a linked job' };
  }

  // Pre-claim guard — ownership tokens reduce (but cannot eliminate) concurrent execution
  if (qr.conversionToken) {
    return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: 'Already claimed by another execution' };
  }

  // ACHU-092: Validate
  const v = validateQuoteRequest(qr);
  if (!v.valid) {
    const validationMsg = v.errors.join('; ');
    // ACHU-058: Revision-guarded write — no ownership token yet
    await revisionGuardedQRWrite(
      qrId,
      { status: 'Conversion Error', conversionError: `Validation failed: ${validationMsg}` },
      capturedRevision,
    );
    await logAuditSafe({
      entityType: 'QuoteRequest', entityId: qrId, action: 'quoterequest_conversion_failed', performedBy,
      summary: `Validation failed for QR ${displayId}: ${validationMsg}`,
      metadata: { validationErrors: v.errors },
    });
    return { quoteRequestId: qrId, displayId, outcome: 'failed', reason: `Validation: ${validationMsg}` };
  }

  // Ownership claim (execution control — reduces but does not eliminate concurrency)
  // ACHU-058: Revision-guarded — verifies no change since entry-point check
  const token = generateToken();
  try {
    await revisionGuardedQRWrite(
      qrId,
      { status: 'Processing', conversionToken: token },
      capturedRevision,
    );
  } catch {
    return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: 'Failed to claim ownership' };
  }

  const claimed = await verifyOwnership(qrId, token);
  if (!claimed) {
    return { quoteRequestId: qrId, displayId, outcome: 'skipped', reason: 'Lost ownership race' };
  }

  return await executeConversion(claimed, v, displayId, performedBy, token);
}

// ─── Execute Conversion with Post-Creation Reconciliation ─────────

async function executeConversion(
  qr: any,
  v: ValidationResult,
  displayId: string,
  performedBy: string,
  ownershipToken: string,
): Promise<ConversionResultItem> {
  let customerId: string | undefined;
  let jobId: string | undefined;
  let userAccountId: string | undefined;

  try {
    // ── Ownership check before Step 1 ──
    if (!await verifyOwnership(qr.id, ownershipToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost before customer creation' };
    }

    // ── Step 1: Customer — find-or-create with duplicate reconciliation ──
    const custResult = await findOrCreateCustomer(v, performedBy, displayId);
    customerId = custResult.id;

    if (custResult.created) {
      await logAuditSafe({
        entityType: 'Customer', entityId: customerId, action: 'customer_created', performedBy,
        summary: `Customer ${custResult.reconciled ? 'created (reconciled duplicates)' : 'created'} from Quote Request ${displayId}`,
        newValues: { customerName: v.customerName, email: v.email, status: 'Lead', source: 'QuoteRequest', reconciled: custResult.reconciled },
      });
    }

    // Persist customer link immediately (ACHU-095)
    // ACHU-058: Ownership-guarded write
    await ownedQRWrite(qr.id, { customer: customerId }, ownershipToken);

    if (!await verifyOwnership(qr.id, ownershipToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost after customer creation', customerId };
    }

    // ── Step 2: UserAccount — find-or-create with duplicate reconciliation ──
    const uaResult = await findOrCreateUserAccount(v, customerId, performedBy, displayId);
    userAccountId = uaResult.id;
    const ua = uaResult.record;

    // ACHU-088: Validate role — must be Customer
    if (ua && ua.role && ua.role !== 'Customer') {
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(
        qr.id,
        { status: 'Conversion Error', conversionError: `User Account (${v.email}) has role "${ua.role}", expected "Customer". Review required.` },
        ownershipToken,
      );
      await logAuditSafe({
        entityType: 'QuoteRequest', entityId: qr.id, action: 'quoterequest_conversion_failed', performedBy,
        summary: `QR ${displayId}: UserAccount role conflict — has "${ua.role}", expected "Customer"`,
        metadata: { userAccountId, role: ua.role, email: v.email },
      });
      return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: `User Account role conflict: "${ua.role}" (expected "Customer")`, customerId };
    }

    // ACHU-088: Validate customer linkage
    const existingCustLink = ua ? extractLinkedId(ua.customer) : undefined;
    if (existingCustLink && existingCustLink !== customerId) {
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(
        qr.id,
        { status: 'Conversion Error', conversionError: `User Account (${v.email}) is linked to a different customer (${existingCustLink}). Review required.` },
        ownershipToken,
      );
      return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: 'User Account ownership conflict: linked to different customer', customerId, userAccountId };
    }

    if (!existingCustLink) {
      await UserAccounts.update({ id: userAccountId, record: { customer: customerId } });
    }

    if (uaResult.created) {
      await logAuditSafe({
        entityType: 'UserAccount', entityId: userAccountId, action: 'useraccount_created', performedBy,
        summary: `User Account ${uaResult.reconciled ? 'created (reconciled duplicates)' : 'created'} from Quote Request ${displayId}`,
        newValues: { email: v.email, role: 'Customer', active: false, source: 'QuoteRequest', reconciled: uaResult.reconciled },
      });
    }

    if (!await verifyOwnership(qr.id, ownershipToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost after user account step', customerId, userAccountId };
    }

    // ── Step 3: Job — find-or-create with duplicate reconciliation ──
    const jobResult = await findOrCreateJob(qr.id, customerId, v, performedBy, displayId);
    jobId = jobResult.id;

    if (jobResult.created) {
      await logAuditSafe({
        entityType: 'Job', entityId: jobId, action: 'job_created', performedBy,
        summary: `Job ${jobResult.reconciled ? 'created (reconciled duplicates)' : 'created'} from Quote Request ${displayId}`,
        newValues: { customer: customerId, service: v.service, status: 'Enquiry', source: 'QuoteRequest', reconciled: jobResult.reconciled },
      });
    }

    // Persist job link immediately (ACHU-095)
    // ACHU-058: Ownership-guarded write
    await ownedQRWrite(qr.id, { job: jobId }, ownershipToken);

    if (!await verifyOwnership(qr.id, ownershipToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost after job creation (job saved)', customerId, jobId, userAccountId };
    }

    // ── Step 4: Finalise ──
    // ACHU-058: Ownership-guarded write
    await ownedQRWrite(
      qr.id,
      { status: 'Converted', conversionError: undefined },
      ownershipToken,
    );

    await logAuditSafe({
      entityType: 'QuoteRequest', entityId: qr.id, action: 'quoterequest_converted', performedBy,
      summary: `Quote Request ${displayId} converted successfully`,
      newValues: { customerId, jobId, userAccountId },
    });

    return { quoteRequestId: qr.id, displayId, outcome: 'converted', customerId, jobId, userAccountId };
  } catch (e: any) {
    const errMsg = e?.message || 'Unknown error';
    try {
      // ACHU-058: Ownership-guarded write (best-effort — may fail if ownership lost)
      const errorRecord: Record<string, unknown> = { status: 'Conversion Error', conversionError: errMsg };
      if (customerId) errorRecord.customer = customerId;
      if (jobId) errorRecord.job = jobId;
      await ownedQRWrite(qr.id, errorRecord, ownershipToken);
    } catch { /* best-effort */ }

    await logAuditSafe({
      entityType: 'QuoteRequest', entityId: qr.id, action: 'quoterequest_conversion_failed', performedBy,
      summary: `Conversion FAILED for QR ${displayId}: ${errMsg}`,
      metadata: { error: errMsg, customerId, jobId, userAccountId },
    });
    return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: errMsg, customerId, jobId };
  }
}

// ─── Resume Interrupted Conversion (ACHU-095) ─────────────────────

async function resumeConversion(
  qr: any,
  displayId: string,
  performedBy: string,
): Promise<ConversionResultItem> {
  // ACHU-058: Capture revision for pre-ownership writes
  const qrRevision = computeRevision(qr, REVISION_FIELDS.quoteRequest);

  const v = validateQuoteRequest(qr);
  if (!v.valid) {
    const validationMsg = v.errors.join('; ');
    // ACHU-058: Revision-guarded write — no ownership token yet
    await revisionGuardedQRWrite(
      qr.id,
      { status: 'Conversion Error', conversionError: `Resume validation failed: ${validationMsg}` },
      qrRevision,
    );
    return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: `Validation: ${validationMsg}` };
  }

  // Claim ownership for resume
  // ACHU-058: Revision-guarded write — verifies no change since entry read
  const resumeToken = generateToken();
  await revisionGuardedQRWrite(
    qr.id,
    { status: 'Processing', conversionToken: resumeToken },
    qrRevision,
  );
  const verified = await verifyOwnership(qr.id, resumeToken);
  if (!verified) {
    return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Failed to claim for resume' };
  }

  let customerId = extractLinkedId(qr.customer);
  let userAccountId: string | undefined;
  let jobId = extractLinkedId(qr.job);

  try {
    // ── Step 1: Customer ──
    if (!customerId) {
      if (!await verifyOwnership(qr.id, resumeToken)) {
        return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost during resume (pre-customer)' };
      }
      const custResult = await findOrCreateCustomer(v, performedBy, displayId);
      customerId = custResult.id;
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(qr.id, { customer: customerId }, resumeToken);

      if (!await verifyOwnership(qr.id, resumeToken)) {
        return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost during resume (post-customer)', customerId };
      }
    }

    // ── Step 2: UserAccount ──
    if (!await verifyOwnership(qr.id, resumeToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost during resume (pre-ua)', customerId };
    }

    const uaResult = await findOrCreateUserAccount(v, customerId, performedBy, displayId);
    userAccountId = uaResult.id;
    const ua = uaResult.record;

    if (ua && ua.role && ua.role !== 'Customer') {
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(
        qr.id,
        { status: 'Conversion Error', conversionError: `Resume: User Account (${v.email}) has role "${ua.role}", expected "Customer".` },
        resumeToken,
      );
      return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: `User Account role conflict: "${ua.role}"`, customerId };
    }
    const existingCustLink = ua ? extractLinkedId(ua.customer) : undefined;
    if (existingCustLink && existingCustLink !== customerId) {
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(
        qr.id,
        { status: 'Conversion Error', conversionError: `Resume: User Account (${v.email}) linked to different customer.` },
        resumeToken,
      );
      return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: 'User Account ownership conflict', customerId, userAccountId };
    }
    if (!existingCustLink) {
      await UserAccounts.update({ id: userAccountId, record: { customer: customerId } });
    }

    if (!await verifyOwnership(qr.id, resumeToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost during resume (post-ua)', customerId, userAccountId };
    }

    // ── Step 3: Job ──
    if (!jobId) {
      const jobResult = await findOrCreateJob(qr.id, customerId, v, performedBy, displayId);
      jobId = jobResult.id;
      // ACHU-058: Ownership-guarded write
      await ownedQRWrite(qr.id, { job: jobId }, resumeToken);
    }

    if (!await verifyOwnership(qr.id, resumeToken)) {
      return { quoteRequestId: qr.id, displayId, outcome: 'skipped', reason: 'Ownership lost during resume (post-job, job saved)', customerId, jobId, userAccountId };
    }

    // Finalise
    // ACHU-058: Ownership-guarded write
    await ownedQRWrite(
      qr.id,
      { status: 'Converted', conversionError: undefined },
      resumeToken,
    );

    await logAuditSafe({
      entityType: 'QuoteRequest', entityId: qr.id, action: 'quoterequest_conversion_resumed', performedBy,
      summary: `Quote Request ${displayId} conversion resumed and completed`,
      newValues: { customerId, jobId, userAccountId },
    });

    return { quoteRequestId: qr.id, displayId, outcome: 'resumed', customerId, jobId, userAccountId };
  } catch (e: any) {
    const errMsg = e?.message || 'Unknown error';
    try {
      // ACHU-058: Ownership-guarded write (best-effort — may fail if ownership lost)
      const errorRecord: Record<string, unknown> = { status: 'Conversion Error', conversionError: `Resume failed: ${errMsg}` };
      if (customerId) errorRecord.customer = customerId;
      if (jobId) errorRecord.job = jobId;
      await ownedQRWrite(qr.id, errorRecord, resumeToken);
    } catch { /* best-effort */ }
    return { quoteRequestId: qr.id, displayId, outcome: 'failed', reason: errMsg, customerId };
  }
}
