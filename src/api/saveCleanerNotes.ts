import { z } from 'zod';
import { createEndpoint, Jobs, JobAssignments, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';
import { reserveToken, completeToken, failToken, withRequestToken, type ReserveResult, type ReconcileFn } from '../lib/idempotency';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    jobId: z.string().min(1),
    cleanerCompletionNotes: z.string().max(5000),
    // ACHU-116: Idempotency token for safe retry
    requestToken: z.string().max(100).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (!context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    if (context.user.role !== 'Cleaner') throw new ZiteError({ code: 'FORBIDDEN', message: 'Only cleaners can use this endpoint' });

    const cleanerId = Array.isArray(context.user.cleaner) ? context.user.cleaner[0] : context.user.cleaner;
    if (!cleanerId) throw new ZiteError({ code: 'FORBIDDEN', message: 'No cleaner record linked to your account' });

    const cleaner = await Cleaners.findOne({ id: cleanerId });
    if (!cleaner || !cleaner.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Your cleaner record is not active' });

    const assignment = await JobAssignments.findOne({ filters: { job: input.jobId, cleaner: cleanerId } });
    if (!assignment) throw new ZiteError({ code: 'FORBIDDEN', message: 'You are not assigned to this job' });

    const job = await Jobs.findOne({ id: input.jobId });
    if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });

    // ACHU-116: Reserve idempotency token before mutation (fail-closed)
    // Reconcile: re-read job notes to see if the mutation already took effect.
    const trimmedNotes = input.cleanerCompletionNotes.trim();
    let tokenReservation: ReserveResult | null = null;
    if (input.requestToken) {
      const reconcile: ReconcileFn = async () => {
        const fresh = await Jobs.findOne({ id: input.jobId, fields: ['id', 'cleanerCompletionNotes'] });
        if (fresh && (fresh.cleanerCompletionNotes ?? '') === trimmedNotes) {
          return { alreadyApplied: true, result: { success: true } };
        }
        return { alreadyApplied: false };
      };
      tokenReservation = await reserveToken({
        requestToken: input.requestToken,
        entityId: input.jobId,
        action: 'job_notes_updated',
        performedBy: context.user.email,
        reconcile,
      });
      if ('alreadyCompleted' in tokenReservation) return tokenReservation.result;
    }

    try {
    const newNotes = trimmedNotes;
    const oldNotes = job.cleanerCompletionNotes ?? '';

    // Only update and audit if the value actually changed
    if (newNotes === oldNotes) {
      const noChangeResult = { success: true as const };
      if (tokenReservation && 'tokenRecordId' in tokenReservation) await completeToken(tokenReservation.tokenRecordId, noChangeResult);
      return noChangeResult;
    }

    await Jobs.update({
      id: input.jobId,
      record: { cleanerCompletionNotes: newNotes },
    });

    const auditWarning = await logAuditSafe({
      entityType: 'Job', entityId: input.jobId, action: 'job_notes_updated',
      performedBy: context.user.email,
      summary: `Cleaner completion notes updated on Job #${job.jobId}`,
      previousValues: { cleanerCompletionNotes: oldNotes || null },
      newValues: { cleanerCompletionNotes: newNotes || null },
      metadata: withRequestToken(undefined, input.requestToken),
    });

    const result = { success: true as const, auditWarning };
    if (tokenReservation && 'tokenRecordId' in tokenReservation) await completeToken(tokenReservation.tokenRecordId, result);
    return result;
    } catch (err) {
      if (tokenReservation && 'tokenRecordId' in tokenReservation) await failToken(tokenReservation.tokenRecordId);
      throw err;
    }
  },
});
