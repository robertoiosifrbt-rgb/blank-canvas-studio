import { z } from 'zod';
import { createEndpoint, Payments, Jobs, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { isValidDate, monetaryRound, isValidMoneyAmount, computePaymentSignature, LIMITS } from '../lib/validation';
import { logAuditSafe, logAuditBestEffort } from '../lib/audit';
import { paymentDuplicateMatchSchema } from '../lib/zodSchemas';
import { getJobFinancialTreatment } from '../lib/jobFinancialPolicy';
import { getJobPaymentTotals, refundExceedsError } from '../lib/refundGuard';
import { toPence } from '../lib/money';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

const VALID_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Payment Link', 'Other'];
const VALID_PROVIDERS = ['Square', 'Bank', 'Cash', 'Halifax', 'Other'];
const VALID_STATUSES = ['Pending', 'Received', 'Failed', 'Refunded', 'Cancelled'];
const MATERIAL_FIELDS = ['job', 'paymentDate', 'amount', 'paymentMethod', 'paymentProvider', 'paymentStatus', 'externalReference', 'voidStatus'] as const;

type DuplicateMatch = z.infer<typeof paymentDuplicateMatchSchema>;

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    job: z.string().min(1, 'Job is required'),
    customer: z.string().nullable().optional(),
    paymentDate: z.string().min(1, 'Payment date is required'),
    // ACHU-084: Amount must be > 0 for all payment statuses
    amount: z.number().gt(0, 'Amount must be greater than zero'),
    paymentMethod: z.string().nullable().optional(),
    paymentProvider: z.string().nullable().optional(),
    paymentStatus: z.string().nullable().optional(),
    externalReference: z.string().nullable().optional(),
    notes: z.string().max(LIMITS.notes).nullable().optional(),
    voidStatus: z.string().nullable().optional(),
    correctionNotes: z.string().max(LIMITS.correctionNotes).nullable().optional(),
    idempotencyToken: z.string().nullable().optional(),
    duplicateOverrideConfirmed: z.boolean().nullable().optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    duplicateConflict: z.boolean().optional(),
    duplicates: z.array(paymentDuplicateMatchSchema).optional(),
    refundInfo: z.object({
      totalActiveReceived: z.number(),
      totalActiveRefunded: z.number(),
      maxRefundable: z.number(),
    }).optional(),
    auditWarning: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ─── Normalize null → undefined for optional fields ───
    const n = (v: string | null | undefined): string | undefined => (v == null || v === '') ? undefined : v;
    input.customer = n(input.customer) as any;
    input.paymentMethod = n(input.paymentMethod) as any;
    input.paymentProvider = n(input.paymentProvider) as any;
    input.paymentStatus = n(input.paymentStatus) as any;
    input.externalReference = n(input.externalReference) as any;
    input.notes = n(input.notes) as any;
    input.voidStatus = n(input.voidStatus) as any;
    input.correctionNotes = n(input.correctionNotes) as any;
    input.idempotencyToken = n(input.idempotencyToken) as any;

    if (!isValidDate(input.paymentDate)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid payment date. Use a valid date in YYYY-MM-DD format.' });
    }

    // ACHU-123: Monetary precision — reject > 2 decimal places
    if (!isValidMoneyAmount(input.amount)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Amount must have at most 2 decimal places (e.g. 10.50).' });
    }
    // Normalise to exactly 2dp at write boundary
    input.amount = monetaryRound(input.amount);

    // Derive customer from job
    const job = await Jobs.findOne({ id: input.job });
    if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });
    const customerId = Array.isArray(job.customer) ? job.customer[0] : job.customer;
    if (!customerId) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Job has no linked customer' });

    if (input.paymentMethod && !VALID_METHODS.includes(input.paymentMethod)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid payment method: ${input.paymentMethod}` });
    }
    if (input.paymentProvider && !VALID_PROVIDERS.includes(input.paymentProvider)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid payment provider: ${input.paymentProvider}` });
    }
    const status = input.paymentStatus ?? 'Pending';
    if (!VALID_STATUSES.includes(status)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid payment status: ${status}` });
    }

    const voidStatus = input.voidStatus ?? 'Active';
    if (voidStatus !== 'Active' && voidStatus !== 'Voided') {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Void status must be Active or Voided' });
    }

    // ACHU-126: Job financial eligibility — reject Received/Refunded on excluded jobs
    if ((status === 'Received' || status === 'Refunded') && voidStatus === 'Active') {
      const treatment = getJobFinancialTreatment(job.status, job.amountCharged);
      if (!treatment.includesAmountDue) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: `Cannot record a ${status.toLowerCase()} payment on a "${job.status}" job${(job.amountCharged ?? 0) === 0 ? ' with no charge' : ''}. The job must be financially eligible first.`,
        });
      }
    }

    // ACHU-083: Refund validation using penny-safe arithmetic
    if (status === 'Refunded' && voidStatus === 'Active') {
      const { receivedPence, refundedPence } = await getJobPaymentTotals(input.job, input.id);
      const proposedPence = toPence(input.amount);
      if (refundedPence + proposedPence > receivedPence) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: refundExceedsError(refundedPence + proposedPence, receivedPence, 'Refund cannot be recorded'),
        });
      }
    }

    // ─── ACHU-017: Same-token idempotency (quick return) ───
    if (input.idempotencyToken && !input.id) {
      const existing = await Payments.findOne({ filters: { idempotencyToken: input.idempotencyToken } });
      if (existing) return { success: true, id: existing.id };
    }

    // ─── Duplicate detection for new/edited active payments ───
    const isCreating = !input.id;
    const isActivePayment = voidStatus === 'Active';
    let duplicateMatches: DuplicateMatch[] = [];

    if (isActivePayment) {
      let shouldCheck = isCreating;
      if (input.id) {
        const existing = await Payments.findOne({ id: input.id });
        if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Payment not found' });
        const materialChanged =
          existing.paymentDate !== input.paymentDate ||
          monetaryRound(existing.amount ?? 0) !== monetaryRound(input.amount) ||
          (Array.isArray(existing.job) ? existing.job[0] : existing.job) !== input.job;
        shouldCheck = materialChanged;
      }

      if (shouldCheck) {
        const allPayments = await fetchAll(
          (p) => Payments.findAll(p),
          { fields: ['id', 'paymentId', 'paymentDate', 'amount', 'customer', 'job', 'paymentStatus', 'externalReference', 'voidStatus'] },
        );
        const matches = allPayments.filter(p => {
          if (p.voidStatus === 'Voided') return false;
          if (input.id && p.id === input.id) return false;
          const sameDate = p.paymentDate === input.paymentDate;
          const sameAmount = monetaryRound(p.amount ?? 0) === monetaryRound(input.amount);
          const pCust = Array.isArray(p.customer) ? p.customer[0] : p.customer;
          const sameCust = pCust === customerId;
          const pJob = Array.isArray(p.job) ? p.job[0] : p.job;
          const sameJob = pJob === input.job;
          const sameStatus = p.paymentStatus === status;
          const extMatch = (input.externalReference && p.externalReference)
            ? p.externalReference === input.externalReference : true;
          return sameDate && sameAmount && sameCust && sameJob && sameStatus && extMatch;
        });
        duplicateMatches = matches.slice(0, 5).map(p => ({
          paymentId: p.paymentId,
          paymentDate: p.paymentDate,
          amount: p.amount,
          paymentStatus: p.paymentStatus,
          externalReference: p.externalReference,
        }));
        if (duplicateMatches.length > 0 && !input.duplicateOverrideConfirmed) {
          return { success: false, id: '', duplicateConflict: true, duplicates: duplicateMatches };
        }
      }
    }

    // ─── Build record ───
    const record: Record<string, unknown> = {
      job: input.job,
      customer: customerId,
      paymentDate: input.paymentDate,
      amount: input.amount,
      paymentMethod: input.paymentMethod?.trim() ?? undefined,
      paymentProvider: input.paymentProvider?.trim() ?? undefined,
      paymentStatus: status,
      externalReference: input.externalReference?.trim() ?? undefined,
      notes: input.notes?.trim() ?? undefined,
      updatedBy: context.user.email,
    };

    // Duplicate override audit metadata
    if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
      record.duplicateCheckStatus = 'Reviewed — Saved Anyway';
      record.duplicateOverrideBy = context.user.email;
      record.duplicateOverrideAt = new Date().toISOString();
      record.duplicateMatchedPaymentIDs = duplicateMatches.map(d => `#${d.paymentId}`).join(', ');
    } else if (duplicateMatches.length === 0 && (isCreating || isActivePayment)) {
      record.duplicateCheckStatus = 'Clear';
    }

    // ─── UPDATE path ───
    if (input.id) {
      const existing = await Payments.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Payment not found' });

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.payment);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      // ACHU-083: Refund integrity revalidation when modifying a Received payment
      const wasReceived = existing.paymentStatus === 'Received' && existing.voidStatus !== 'Voided';
      const originalJobId = Array.isArray(existing.job) ? existing.job[0] : existing.job;

      if (wasReceived && originalJobId) {
        const jobChanged = originalJobId !== input.job;
        const statusChangedFromReceived = status !== 'Received';
        const amountReduced = monetaryRound(input.amount) < monetaryRound(existing.amount ?? 0);

        if (jobChanged || statusChangedFromReceived || amountReduced) {
          // Compute state on original job without this payment
          const { receivedPence, refundedPence } = await getJobPaymentTotals(originalJobId, input.id);
          // If payment stays on this job as Received (just reduced), add the new amount back
          let adjustedReceivedPence = receivedPence;
          if (!jobChanged && !statusChangedFromReceived) {
            adjustedReceivedPence += toPence(input.amount);
          }
          if (refundedPence > adjustedReceivedPence) {
            throw new ZiteError({
              code: 'BAD_REQUEST',
              message: refundExceedsError(refundedPence, adjustedReceivedPence, 'Cannot apply this change'),
            });
          }
        }
      }

      const submitted: Record<string, unknown> = {
        job: input.job, paymentDate: input.paymentDate, amount: input.amount,
        paymentMethod: input.paymentMethod?.trim() ?? undefined,
        paymentProvider: input.paymentProvider?.trim() ?? undefined,
        paymentStatus: status, externalReference: input.externalReference?.trim() ?? undefined, voidStatus,
      };
      let materialChange = false;
      for (const field of MATERIAL_FIELDS) {
        const oldVal = field === 'job'
          ? (Array.isArray(existing.job) ? existing.job[0] : existing.job)
          : (existing as any)[field];
        const newVal = submitted[field];
        if (String(oldVal ?? '') !== String(newVal ?? '')) { materialChange = true; break; }
      }
      if (materialChange && !input.correctionNotes?.trim()) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Correction notes are required when making material changes to a payment.' });
      }

      record.voidStatus = voidStatus;
      if (input.correctionNotes?.trim()) record.correctionNotes = input.correctionNotes.trim();

      // ACHU-017: Compute new signature and check for collision with another active record
      const newSig = computePaymentSignature(input.job, input.paymentDate, input.amount, status, input.externalReference);
      if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
        record.duplicateSignature = `${newSig}:ovr:${Date.now()}`;
      } else {
        record.duplicateSignature = newSig;
      }

      await Payments.update({ id: input.id, record });

      // Extended audit comparison — all material editable fields
      const payAuditFields = [
        'job', 'customer', 'paymentDate', 'amount', 'paymentMethod', 'paymentProvider',
        'paymentStatus', 'externalReference', 'notes', 'voidStatus',
      ] as const;
      const payPrev: Record<string, unknown> = {};
      const payNew: Record<string, unknown> = {};
      for (const f of payAuditFields) {
        const linkedFields = ['job', 'customer'];
        const oldV = linkedFields.includes(f)
          ? (Array.isArray((existing as any)[f]) ? (existing as any)[f][0] : (existing as any)[f])
          : (existing as any)[f];
        const newV = f === 'voidStatus' ? voidStatus : (record as any)[f];
        const oldStr = (oldV == null || oldV === '') ? '' : String(oldV);
        const newStr = (newV == null || newV === '') ? '' : String(newV);
        if (oldStr !== newStr) { payPrev[f] = oldV ?? null; payNew[f] = newV ?? null; }
      }
      const auditWarning = await logAuditSafe({
        entityType: 'Payment', entityId: input.id, action: 'payment_edited',
        performedBy: context.user.email,
        summary: `Payment #${existing.paymentId} edited`,
        previousValues: Object.keys(payPrev).length > 0 ? payPrev : { amount: existing.amount },
        newValues: Object.keys(payNew).length > 0 ? payNew : { amount: input.amount },
        correctionNotes: input.correctionNotes?.trim(),
      });
      return { success: true, id: input.id, auditWarning };
    }

    // ─── CREATE path ───
    record.createdBy = context.user.email;
    record.voidStatus = 'Active';
    if (input.idempotencyToken) record.idempotencyToken = input.idempotencyToken;

    // ACHU-017: Compute deterministic duplicate signature.
    const sig = computePaymentSignature(input.job, input.paymentDate, input.amount, status, input.externalReference);
    record.duplicateSignature = (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed)
      ? `${sig}:ovr:${Date.now()}`
      : sig;

    const created = await Payments.create({ record: record as any });

    // ACHU-047: Safe audit — partial success if audit fails
    const auditWarning = await logAuditSafe({
      entityType: 'Payment', entityId: created.id,
      action: status === 'Refunded' ? 'payment_refunded' : 'payment_created',
      performedBy: context.user.email,
      summary: `Payment created (${status})`,
      newValues: { amount: input.amount, paymentDate: input.paymentDate, paymentStatus: status },
    });

    if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
      await logAuditBestEffort({
        entityType: 'Payment', entityId: created.id,
        action: 'payment_duplicate_override',
        performedBy: context.user.email,
        summary: `Duplicate override: saved despite matching ${duplicateMatches.map(d => '#' + d.paymentId).join(', ')}`,
      });
    }

    return { success: true, id: created.id, auditWarning };
  },
});
