import { z } from 'zod';
import { createEndpoint, Jobs, JobAssignments, Cleaners, JobChecklistItems, ZiteError } from 'zite-integrations-backend-sdk';
import { isValidTime, LIMITS, extractId, summariseNotes, validateEffectiveTimeRange } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';
import { buildActualTimestampFields } from '../lib/actualTimestamps';
import { ukToday, ukTimeNow } from '../lib/ukDate';
import { ensureJobChecklist } from '../lib/ensureJobChecklist';
import { fetchAll } from '../lib/fetchAll';
import { reserveToken, completeToken, failToken, withRequestToken, type ReserveResult, type ReconcileFn } from '../lib/idempotency';

const VALID_STATUSES = ['Enquiry', 'Booked', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Access'];
const CLEANER_TRANSITIONS: Record<string, string[]> = {
  'Booked': ['In Progress', 'No Access'],
  'Confirmed': ['In Progress', 'No Access'],
  'In Progress': ['Completed', 'No Access'],
};

/**
 * ACHU-114: Backend checklist enforcement — fail closed.
 * Loads checklist items directly from the database and verifies all mandatory items are complete.
 * Never trusts client-supplied checklist state.
 * Returns { valid: true } or throws.
 */
async function enforceChecklistCompletion(jobId: string): Promise<{ valid: true; total: number; completed: number }> {
  // Load the job to get quote request link
  const job = await Jobs.findOne({ id: jobId, fields: ['id', 'quoteRequests'] });
  if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found during checklist verification' });

  const qrId = extractId(job.quoteRequests);
  if (!qrId) {
    // No quote request linked — no checklist to enforce
    return { valid: true, total: 0, completed: 0 };
  }

  // Ensure checklist exists (lazy generation if needed)
  await ensureJobChecklist(jobId);

  // Load all checklist items from DB (authoritative source)
  let items: Awaited<ReturnType<typeof fetchAll<any>>>;
  try {
    items = await fetchAll(
      (p) => JobChecklistItems.findAll(p),
      { filters: { job: jobId } },
    );
  } catch (e: any) {
    // ACHU-114: Fail closed on database errors
    throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Failed to load checklist for verification. Cannot complete job.' });
  }

  // Filter to active (non-obsolete) items
  const active = items.filter(i => !i.obsolete);
  if (active.length === 0) {
    return { valid: true, total: 0, completed: 0 };
  }

  const completed = active.filter(i => i.completed || i.notApplicable).length;
  const total = active.length;

  if (completed < total) {
    const remaining = total - completed;
    throw new ZiteError({
      code: 'BAD_REQUEST',
      message: `Cannot complete job: ${remaining} checklist item${remaining === 1 ? '' : 's'} still incomplete (${completed}/${total} done). Complete all items or use override.`,
    });
  }

  return { valid: true, total, completed };
}

/**
 * ACHU-134: Prevent completing a job before its scheduled start date/time.
 * Only "In Progress" → "Completed" is allowed; any other status → Completed is rejected.
 * Also rejects if current Europe/London time is before the scheduled start.
 */
function enforceCompletionTiming(
  job: { status?: string | null; jobDate?: string | null; startTime?: string | null; jobId?: any },
  performedBy: string,
): void {
  // 1. Only In Progress → Completed is valid
  const currentStatus = job.status ?? '';
  if (currentStatus !== 'In Progress') {
    throw new ZiteError({
      code: 'BAD_REQUEST',
      message: `This job cannot be completed before its scheduled start time.`,
    });
  }

  // 2. Current Europe/London time must be >= scheduled start date/time
  const scheduledDate = job.jobDate; // YYYY-MM-DD
  if (scheduledDate) {
    const today = ukToday(); // YYYY-MM-DD
    if (today < scheduledDate) {
      // Date alone is in the future — block
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'This job cannot be completed before its scheduled start time.',
      });
    }
    if (today === scheduledDate && job.startTime) {
      // Same day — compare times
      const nowTime = ukTimeNow(); // HH:MM
      if (nowTime < job.startTime) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: 'This job cannot be completed before its scheduled start time.',
        });
      }
    }
  }
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    status: z.string(),
    cleanerCompletionNotes: z.string().max(LIMITS.completionNotes).optional(),
    notes: z.string().max(LIMITS.notes).optional(),
    startTime: z.string().max(5).optional(),
    finishTime: z.string().max(5).optional(),
    // ACHU-115: Checklist override fields
    checklistOverrideReason: z.string().max(2000).optional(),
    // ACHU-116: Idempotency token for safe retry
    requestToken: z.string().max(100).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (!context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    if (!VALID_STATUSES.includes(input.status)) throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid status: ${input.status}` });

    const job = await Jobs.findOne({ id: input.id });
    if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });

    // ACHU-116: Reserve idempotency token before mutation (fail-closed)
    // Reconcile: re-read job status to determine if mutation already occurred.
    let tokenReservation: ReserveResult | null = null;
    if (input.requestToken) {
      const reconcile: ReconcileFn = async () => {
        const fresh = await Jobs.findOne({ id: input.id, fields: ['id', 'status'] });
        if (fresh && fresh.status === input.status) {
          return { alreadyApplied: true, result: { success: true } };
        }
        return { alreadyApplied: false };
      };
      tokenReservation = await reserveToken({
        requestToken: input.requestToken,
        entityId: input.id,
        action: `job_status_${input.status}`,
        performedBy: context.user.email,
        reconcile,
      });
      if ('alreadyCompleted' in tokenReservation) return tokenReservation.result;
    }

    try {
    // ── Begin guarded mutation block ──

    if (context.user.role === 'Cleaner') {
      const cleanerId = Array.isArray(context.user.cleaner) ? context.user.cleaner[0] : context.user.cleaner;
      if (!cleanerId) throw new ZiteError({ code: 'FORBIDDEN', message: 'No cleaner record linked' });
      const cleaner = await Cleaners.findOne({ id: cleanerId });
      if (!cleaner || !cleaner.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Your cleaner account is not active' });
      const assignment = await JobAssignments.findOne({ filters: { job: input.id, cleaner: cleanerId } });
      if (!assignment) throw new ZiteError({ code: 'FORBIDDEN', message: 'You are not assigned to this job' });

      const currentStatus = job.status ?? '';
      if (currentStatus === input.status) {
        // Already in desired state — complete the token and return
        if (tokenReservation && 'tokenRecordId' in tokenReservation) await completeToken(tokenReservation.tokenRecordId, { success: true });
        return { success: true };
      }
      const allowed = CLEANER_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(input.status)) throw new ZiteError({ code: 'FORBIDDEN', message: `You cannot change status from ${currentStatus} to ${input.status}` });

      // ACHU-134: Prevent future completion — cleaner path
      if (input.status === 'Completed') {
        try {
          enforceCompletionTiming(job, context.user.email);
        } catch (e) {
          // Audit the rejected attempt
          await logAuditSafe({
            entityType: 'Job', entityId: input.id, action: 'job_completion_rejected',
            performedBy: context.user.email,
            summary: `Cleaner attempted to complete Job #${job.jobId} before scheduled start time (status: ${job.status}, jobDate: ${job.jobDate}, startTime: ${job.startTime})`,
            metadata: { role: 'Cleaner', currentStatus: job.status, jobDate: job.jobDate, startTime: job.startTime },
          });
          throw e;
        }
      }

      // ACHU-114: Backend checklist enforcement before Completed
      if (input.status === 'Completed') {
        const overrideReason = input.checklistOverrideReason?.trim();
        const hasOverride = typeof overrideReason === 'string' && overrideReason.length >= 10;

        if (!hasOverride) {
          // Enforce checklist — will throw if incomplete
          await enforceChecklistCompletion(input.id);
        } else {
          // ACHU-115: Validate override reason
          if (overrideReason.length < 10) {
            throw new ZiteError({ code: 'BAD_REQUEST', message: 'Override reason must be at least 10 characters.' });
          }
        }
      }

      const record: Record<string, unknown> = { status: input.status };
      const ts = buildActualTimestampFields(input.status, job);
      Object.assign(record, ts.record);

      // ACHU-115: Store cleaner completion notes separately — never overwrite with override
      const completionNotes = input.cleanerCompletionNotes ?? input.notes;
      if (completionNotes !== undefined) record.cleanerCompletionNotes = completionNotes.trim();

      // ACHU-115: Store override fields separately
      if (input.status === 'Completed' && input.checklistOverrideReason?.trim()) {
        const overrideReason = input.checklistOverrideReason.trim();
        record.checklistOverrideReason = overrideReason;
        record.checklistOverrideBy = context.user.email;
        record.checklistOverrideAt = new Date().toISOString();
      }

      await Jobs.update({ id: input.id, record });

      // Audit for status change
      const auditWarning = await logAuditSafe({
        entityType: 'Job', entityId: input.id, action: 'job_status_changed',
        performedBy: context.user.email,
        summary: `Job #${job.jobId} status changed by cleaner: ${currentStatus} → ${input.status}`,
        previousValues: { status: currentStatus, ...ts.auditPrev },
        newValues: { status: input.status, ...ts.auditNew },
        metadata: withRequestToken(undefined, input.requestToken),
      });

      // ACHU-115: Separate audit event for override
      if (input.status === 'Completed' && input.checklistOverrideReason?.trim()) {
        await logAuditSafe({
          entityType: 'Job', entityId: input.id, action: 'job_edited',
          performedBy: context.user.email,
          summary: `Checklist override used on Job #${job.jobId}: "${input.checklistOverrideReason.trim().slice(0, 100)}"`,
          newValues: {
            checklistOverrideReason: input.checklistOverrideReason.trim(),
            checklistOverrideBy: context.user.email,
            checklistOverrideAt: new Date().toISOString(),
          },
          metadata: withRequestToken({ overrideType: 'checklist_completion' }, input.requestToken),
        });
      }

      // Generate checklist when status reaches Booked/Confirmed
      if (input.status === 'Booked' || input.status === 'Confirmed') {
        try { await ensureJobChecklist(input.id, context.user.email); } catch (e) { console.error('[updateJobStatus] checklist gen error:', e); }
      }
      const cleanerResult = { success: true as const, auditWarning };
      if (tokenReservation && 'tokenRecordId' in tokenReservation) await completeToken(tokenReservation.tokenRecordId, cleanerResult);
      return cleanerResult;
    }

    // Admin path
    if (context.user.role !== 'Admin') throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    // ACHU-127: Shared effective time validation — considers existing stored values
    const timeErr = validateEffectiveTimeRange(
      input.startTime, input.finishTime,
      job.startTime || undefined, job.finishTime || undefined,
    );
    if (timeErr) throw new ZiteError({ code: 'BAD_REQUEST', message: timeErr });

    const record: Record<string, unknown> = { status: input.status };
    if (input.startTime) record.startTime = input.startTime;
    if (input.finishTime) record.finishTime = input.finishTime;
    if (input.status === 'Completed' && !input.finishTime && !job.finishTime) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Completed jobs require a finish time' });
    if (input.notes !== undefined) record.adminNotes = input.notes.trim();
    if (input.cleanerCompletionNotes !== undefined) record.cleanerCompletionNotes = input.cleanerCompletionNotes.trim();

    // ACHU-134: Prevent future completion — admin path
    if (input.status === 'Completed') {
      try {
        enforceCompletionTiming(job, context.user.email);
      } catch (e) {
        await logAuditSafe({
          entityType: 'Job', entityId: input.id, action: 'job_completion_rejected',
          performedBy: context.user.email,
          summary: `Admin attempted to complete Job #${job.jobId} before scheduled start time (status: ${job.status}, jobDate: ${job.jobDate}, startTime: ${job.startTime})`,
          metadata: { role: 'Admin', currentStatus: job.status, jobDate: job.jobDate, startTime: job.startTime },
        });
        throw e;
      }
    }

    // ACHU-114: Backend checklist enforcement for admin completing a job
    if (input.status === 'Completed') {
      const overrideReason = input.checklistOverrideReason?.trim();
      const hasOverride = typeof overrideReason === 'string' && overrideReason.length >= 10;

      if (!hasOverride) {
        // Enforce checklist — will throw if incomplete
        try {
          await enforceChecklistCompletion(input.id);
        } catch (e: any) {
          // Admin can still override
          if (e instanceof ZiteError && e.code === 'BAD_REQUEST' && !overrideReason) {
            throw e; // Re-throw — admin must provide override reason
          }
          throw e;
        }
      }

      // ACHU-115: Store override fields for admin too
      if (overrideReason && overrideReason.length >= 10) {
        record.checklistOverrideReason = overrideReason;
        record.checklistOverrideBy = context.user.email;
        record.checklistOverrideAt = new Date().toISOString();
      }
    }

    // Actual timestamps — same rules as Cleaner path
    const prevStatus = job.status;
    const ts = buildActualTimestampFields(input.status, job);
    Object.assign(record, ts.record);

    await Jobs.update({ id: input.id, record });

    // ACHU-076: Build accurate audit diff — only audit fields that actually changed
    const statusChanged = (prevStatus ?? '') !== input.status;
    const auditPrev: Record<string, unknown> = {};
    const auditNew: Record<string, unknown> = {};
    if (statusChanged) { auditPrev.status = prevStatus; auditNew.status = input.status; }
    // Scheduled times
    if (input.startTime && input.startTime !== (job.startTime ?? '')) { auditPrev.startTime = job.startTime ?? null; auditNew.startTime = input.startTime; }
    if (input.finishTime && input.finishTime !== (job.finishTime ?? '')) { auditPrev.finishTime = job.finishTime ?? null; auditNew.finishTime = input.finishTime; }
    // Admin notes
    if (input.notes !== undefined) {
      const oldNotes = job.adminNotes ?? '';
      const newNotes = input.notes.trim();
      if (oldNotes !== newNotes) { auditPrev.adminNotes = summariseNotes(oldNotes); auditNew.adminNotes = summariseNotes(newNotes); }
    }
    // Cleaner completion notes
    if (input.cleanerCompletionNotes !== undefined) {
      const oldCN = job.cleanerCompletionNotes ?? '';
      const newCN = input.cleanerCompletionNotes.trim();
      if (oldCN !== newCN) { auditPrev.cleanerCompletionNotes = summariseNotes(oldCN); auditNew.cleanerCompletionNotes = summariseNotes(newCN); }
    }
    // Actual timestamps from status transition
    if (Object.keys(ts.auditPrev).length > 0) Object.assign(auditPrev, ts.auditPrev);
    if (Object.keys(ts.auditNew).length > 0) Object.assign(auditNew, ts.auditNew);

    let auditWarning: string | undefined;
    if (Object.keys(auditNew).length > 0) {
      auditWarning = await logAuditSafe({
        entityType: 'Job', entityId: input.id,
        action: statusChanged ? 'job_status_changed' : 'job_edited',
        performedBy: context.user.email,
        summary: statusChanged
          ? `Job #${job.jobId} status changed: ${prevStatus} → ${input.status}`
          : `Job #${job.jobId} updated`,
        previousValues: auditPrev,
        newValues: auditNew,
        metadata: withRequestToken(undefined, input.requestToken),
      });
    }

    // ACHU-115: Separate audit event for admin override
    if (input.status === 'Completed' && input.checklistOverrideReason?.trim() && input.checklistOverrideReason.trim().length >= 10) {
      await logAuditSafe({
        entityType: 'Job', entityId: input.id, action: 'job_edited',
        performedBy: context.user.email,
        summary: `Checklist override used on Job #${job.jobId} by admin: "${input.checklistOverrideReason.trim().slice(0, 100)}"`,
        newValues: {
          checklistOverrideReason: input.checklistOverrideReason.trim(),
          checklistOverrideBy: context.user.email,
          checklistOverrideAt: new Date().toISOString(),
        },
        metadata: withRequestToken({ overrideType: 'checklist_completion', role: 'Admin' }, input.requestToken),
      });
    }

    // Generate checklist when status reaches Booked/Confirmed
    if (input.status === 'Booked' || input.status === 'Confirmed') {
      try { await ensureJobChecklist(input.id, context.user.email); } catch (e) { console.error('[updateJobStatus] checklist gen error:', e); }
    }
    const adminResult = { success: true as const, auditWarning };
    if (tokenReservation && 'tokenRecordId' in tokenReservation) await completeToken(tokenReservation.tokenRecordId, adminResult);
    return adminResult;

    // ── End guarded mutation block ──
    } catch (err) {
      // ACHU-116: Mark token as Failed so retry with same token is accepted
      if (tokenReservation && 'tokenRecordId' in tokenReservation) await failToken(tokenReservation.tokenRecordId);
      throw err;
    }
  },
});
