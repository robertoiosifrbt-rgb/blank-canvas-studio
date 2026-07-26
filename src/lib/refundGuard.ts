/**
 * ACHU-083: Refund dependency revalidation.
 * 
 * Before any operation that reduces active Received total for a Job, this helper
 * calculates the financial state that would exist after the mutation and rejects
 * it if refunds would exceed receipts.
 * 
 * Used by: savePayment, voidRestorePayment.
 */
import { Payments } from 'zite-integrations-backend-sdk';
import { fetchAll } from './fetchAll';
import { toPence, penceToPounds } from './money';

export type JobPaymentTotals = {
  /** Total active Received in integer pence */
  receivedPence: number;
  /** Total active Refunded in integer pence */
  refundedPence: number;
};

/**
 * Compute the active Received and Refunded totals for a job,
 * optionally excluding a specific payment (e.g. the one being modified).
 * Uses integer pence for precision.
 */
export async function getJobPaymentTotals(
  jobId: string,
  excludePaymentId?: string,
): Promise<JobPaymentTotals> {
  const allJobPayments = await fetchAll(
    (p) => Payments.findAll(p),
    { filters: { job: jobId }, fields: ['id', 'amount', 'paymentStatus', 'voidStatus'] },
  );

  const active = allJobPayments.filter(p =>
    p.voidStatus !== 'Voided' &&
    (!excludePaymentId || p.id !== excludePaymentId)
  );

  const receivedPence = active
    .filter(p => p.paymentStatus === 'Received')
    .reduce((s, p) => s + toPence(p.amount ?? 0), 0);

  const refundedPence = active
    .filter(p => p.paymentStatus === 'Refunded')
    .reduce((s, p) => s + toPence(p.amount ?? 0), 0);

  return { receivedPence, refundedPence };
}

/**
 * Build a user-friendly error message when refunds exceed received.
 */
export function refundExceedsError(refundedPence: number, receivedPence: number, context: string): string {
  return `${context}: refunds (£${penceToPounds(refundedPence)}) would exceed received payments (£${penceToPounds(receivedPence)}) for this job.`;
}
