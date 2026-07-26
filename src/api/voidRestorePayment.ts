import { z } from 'zod';
import { createEndpoint, Payments, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { monetaryRound, computePaymentSignature, LIMITS } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';
import { getJobPaymentTotals } from '../lib/refundGuard';
import { toPence, penceToPounds } from '../lib/money';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    paymentId: z.string().min(1, 'Payment ID is required'),
    action: z.enum(['void', 'restore']),
    correctionNotes: z.string().min(1, 'Correction notes are required').max(LIMITS.correctionNotes),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const existing = await Payments.findOne({ id: input.paymentId });
    if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Payment not found' });

    const newVoidStatus = input.action === 'void' ? 'Voided' : 'Active';

    // ACHU-083: Refund integrity check when VOIDING a Received payment
    // Existing refunds may depend on this Received payment's balance
    if (input.action === 'void' && existing.paymentStatus === 'Received' && existing.voidStatus !== 'Voided') {
      const jobId = Array.isArray(existing.job) ? existing.job[0] : existing.job;
      if (jobId) {
        // Get totals EXCLUDING this payment (it's being voided)
        const { receivedPence, refundedPence } = await getJobPaymentTotals(jobId, input.paymentId);
        if (refundedPence > receivedPence) {
          throw new ZiteError({
            code: 'BAD_REQUEST',
            message: `Cannot void this payment: existing refunds (£${penceToPounds(refundedPence)}) would exceed remaining received payments (£${penceToPounds(receivedPence)}) for this job. Void the refund(s) first.`,
          });
        }
      }
    }

    // ACHU-083: Refund cap validation on RESTORE of a Refunded payment (penny-safe)
    if (input.action === 'restore' && existing.paymentStatus === 'Refunded') {
      const jobId = Array.isArray(existing.job) ? existing.job[0] : existing.job;
      if (jobId) {
        const { receivedPence, refundedPence } = await getJobPaymentTotals(jobId, input.paymentId);
        const proposedRefundPence = toPence(existing.amount ?? 0);
        if (refundedPence + proposedRefundPence > receivedPence) {
          throw new ZiteError({
            code: 'BAD_REQUEST',
            message: `Cannot restore this refund: total refunds (£${penceToPounds(refundedPence + proposedRefundPence)}) would exceed received payments (£${penceToPounds(receivedPence)}) for this job.`,
          });
        }
      }
    }

    // ACHU-017: On restore, check for duplicate signature conflict with another active record
    const updateRecord: Record<string, unknown> = {
      voidStatus: newVoidStatus,
      correctionNotes: input.correctionNotes.trim(),
      updatedBy: context.user.email,
    };

    if (input.action === 'void') {
      // Clear signature so it no longer reserves the active namespace
      updateRecord.duplicateSignature = '';
    } else {
      // Restore: recompute signature and check for collision
      const jobId = Array.isArray(existing.job) ? existing.job[0] : existing.job;
      const restoredSig = computePaymentSignature(
        jobId ?? '', existing.paymentDate ?? '', existing.amount ?? 0,
        existing.paymentStatus ?? '', existing.externalReference
      );

      // Check if another active record already owns this signature
      const allPayments = await fetchAll(
        (p) => Payments.findAll(p),
        { fields: ['id', 'paymentId', 'paymentDate', 'amount', 'paymentStatus', 'voidStatus', 'duplicateSignature'] },
      );
      const conflicting = allPayments.find(p =>
        p.id !== input.paymentId &&
        p.voidStatus !== 'Voided' &&
        p.duplicateSignature === restoredSig
      );

      if (conflicting) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: `Cannot restore: an active payment #${conflicting.paymentId} already exists with the same details (${existing.paymentDate}, £${(existing.amount ?? 0).toFixed(2)}, ${existing.paymentStatus}). Void or edit the conflicting payment first.`,
        });
      }

      updateRecord.duplicateSignature = restoredSig;
    }

    await Payments.update({ id: input.paymentId, record: updateRecord });

    const auditWarning = await logAuditSafe({
      entityType: 'Payment', entityId: input.paymentId,
      action: input.action === 'void' ? 'payment_voided' : 'payment_restored',
      performedBy: context.user.email,
      summary: `Payment #${existing.paymentId} ${input.action === 'void' ? 'voided' : 'restored'}`,
      previousValues: { voidStatus: existing.voidStatus, amount: existing.amount, paymentStatus: existing.paymentStatus },
      newValues: { voidStatus: newVoidStatus },
      correctionNotes: input.correctionNotes.trim(),
    });

    return { success: true, id: input.paymentId, auditWarning };
  },
});
