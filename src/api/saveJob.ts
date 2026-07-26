import { z } from 'zod';
import { createEndpoint, Jobs, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { isValidDate, isValidTime, compareTimes, sanitize, LIMITS, VALID_JOB_STATUSES as VALID_STATUSES, summariseNotes, validateEffectiveTimeRange } from '../lib/validation';
import { isValidMoneyAmount, normaliseMoney } from '../lib/money';
import { logAuditSafe } from '../lib/audit';
import { buildActualTimestampFields } from '../lib/actualTimestamps';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';
import { ukToday, ukTimeNow } from '../lib/ukDate';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    customer: z.string().min(1, 'Customer is required'),
    jobDate: z.string().min(1, 'Job date is required'),
    service: z.string().min(1, 'Service is required').max(LIMITS.service),
    address: z.string().max(LIMITS.address).optional(),
    startTime: z.string().max(5).optional(),
    finishTime: z.string().max(5).optional(),
    status: z.string().optional(),
    amountCharged: z.number().optional(),
    customerInstructions: z.string().max(LIMITS.instructions).optional(),
    adminNotes: z.string().max(LIMITS.notes).optional(),
    cleanerCompletionNotes: z.string().max(LIMITS.completionNotes).optional(),
    notes: z.string().max(LIMITS.notes).optional(),
    quoteNumber: z.string().nullable().optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), warning: z.string().optional(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const status = input.status ?? 'Enquiry';
    if (!VALID_STATUSES.includes(status)) throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid status: ${status}` });
    if (input.amountCharged !== undefined && input.amountCharged < 0) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Amount charged cannot be negative' });
    // ACHU-123: Monetary precision — reject > 2 decimal places, normalise
    if (input.amountCharged !== undefined && input.amountCharged !== 0) {
      if (!isValidMoneyAmount(input.amountCharged)) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Amount charged must have at most 2 decimal places (e.g. 75.00).' });
      }
      input.amountCharged = normaliseMoney(input.amountCharged);
    }

    // Quote Number validation
    let quoteNumber: string | null | undefined;
    if (input.quoteNumber !== undefined) {
      if (input.quoteNumber === null || input.quoteNumber === '') {
        quoteNumber = null; // explicit clear
      } else {
        const trimmed = input.quoteNumber.trim();
        if (trimmed.length > LIMITS.quoteNumber) throw new ZiteError({ code: 'BAD_REQUEST', message: `Quote Number exceeds maximum length of ${LIMITS.quoteNumber} characters.` });
        quoteNumber = trimmed || null;
      }
    }
    if (!isValidDate(input.jobDate)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid job date. Use a valid calendar date in YYYY-MM-DD format.' });

    const customer = await Customers.findOne({ id: input.customer, fields: ['id'] });
    if (!customer) throw new ZiteError({ code: 'NOT_FOUND', message: 'Customer not found' });

    // ACHU-127: Shared time validation — for new jobs, validate submitted pair
    if (!input.id) {
      const timeErr = validateEffectiveTimeRange(input.startTime, input.finishTime);
      if (timeErr) throw new ZiteError({ code: 'BAD_REQUEST', message: timeErr });
    } else {
      // Format validation only — effective range is checked after existing record is loaded
      if (input.startTime && !isValidTime(input.startTime)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Start time must be in HH:MM format (00:00–23:59).' });
      if (input.finishTime && !isValidTime(input.finishTime)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Finish time must be in HH:MM format (00:00–23:59).' });
    }
    if (status === 'Completed' && !input.finishTime) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Completed jobs require a finish time' });

    // ACHU-134: Prevent future completion via saveJob
    if (status === 'Completed') {
      const today = ukToday();
      if (input.jobDate > today) {
        await logAuditSafe({
          entityType: 'Job', entityId: input.id ?? 'new',
          action: 'job_completion_rejected', performedBy: context.user.email,
          summary: `Admin attempted to save job as Completed before scheduled start (jobDate: ${input.jobDate}, startTime: ${input.startTime})`,
          metadata: { role: 'Admin', jobDate: input.jobDate, startTime: input.startTime },
        });
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'This job cannot be completed before its scheduled start time.' });
      }
      if (input.jobDate === today && input.startTime) {
        const nowTime = ukTimeNow();
        if (nowTime < input.startTime) {
          await logAuditSafe({
            entityType: 'Job', entityId: input.id ?? 'new',
            action: 'job_completion_rejected', performedBy: context.user.email,
            summary: `Admin attempted to save job as Completed before scheduled start (jobDate: ${input.jobDate}, startTime: ${input.startTime})`,
            metadata: { role: 'Admin', jobDate: input.jobDate, startTime: input.startTime },
          });
          throw new ZiteError({ code: 'BAD_REQUEST', message: 'This job cannot be completed before its scheduled start time.' });
        }
      }

      // Only In Progress → Completed is valid for existing jobs
      if (input.id) {
        // Will check against existing status after loading the record below
      }
    }

    let warning: string | undefined;
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    if (input.jobDate < todayStr && !input.id) warning = 'This job date is in the past. A historical record has been created.';

    const record: Record<string, unknown> = {
      customer: input.customer, jobDate: input.jobDate,
      service: sanitize(input.service, LIMITS.service) || undefined,
      address: sanitize(input.address, LIMITS.address),
      startTime: input.startTime?.trim() || undefined,
      finishTime: input.finishTime?.trim() || undefined,
      status, amountCharged: input.amountCharged ?? 0,
      adminNotes: sanitize(input.adminNotes ?? input.notes, LIMITS.notes),
      customerInstructions: sanitize(input.customerInstructions, LIMITS.instructions),
      cleanerCompletionNotes: sanitize(input.cleanerCompletionNotes, LIMITS.completionNotes),
      quoteNumber: quoteNumber,
    };

    if (input.id) {
      const existing = await Jobs.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });

      // ACHU-134: Only In Progress → Completed is valid
      if (status === 'Completed' && (existing.status ?? '') !== 'In Progress') {
        await logAuditSafe({
          entityType: 'Job', entityId: input.id!,
          action: 'job_completion_rejected', performedBy: context.user.email,
          summary: `Admin attempted to complete Job #${existing.jobId} from status "${existing.status}" (must be In Progress)`,
          metadata: { role: 'Admin', currentStatus: existing.status, jobDate: input.jobDate, startTime: input.startTime },
        });
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'This job cannot be completed before its scheduled start time.' });
      }

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.job);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      // ACHU-127: Effective time validation for partial updates — uses shared helper
      const timeErr = validateEffectiveTimeRange(
        input.startTime?.trim() || undefined, input.finishTime?.trim() || undefined,
        existing.startTime || undefined, existing.finishTime || undefined,
      );
      if (timeErr) throw new ZiteError({ code: 'BAD_REQUEST', message: timeErr });

      // Actual timestamps if status changed
      const statusChanged = (existing.status ?? '') !== status;
      if (statusChanged) {
        const ts = buildActualTimestampFields(status, existing);
        Object.assign(record, ts.record);
      }

      await Jobs.update({ id: input.id, record });

      // Extended audit comparison
      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      const auditFields = [
        'customer', 'jobDate', 'service', 'address', 'startTime', 'finishTime',
        'actualStartTime', 'actualFinishTime', 'status', 'amountCharged', 'quoteNumber',
        'customerInstructions', 'adminNotes', 'cleanerCompletionNotes',
      ] as const;
      const noteFields = ['adminNotes', 'cleanerCompletionNotes', 'customerInstructions'];
      for (const f of auditFields) {
        const linkedFields = ['customer'];
        const oldV = linkedFields.includes(f)
          ? (Array.isArray((existing as any)[f]) ? (existing as any)[f][0] : (existing as any)[f])
          : (existing as any)[f];
        const hasNewValue = Object.prototype.hasOwnProperty.call(record, f);
        const newV = hasNewValue ? (record as any)[f] : oldV;
        const oldStr = (oldV == null || oldV === '') ? '' : String(oldV);
        const newStr = (newV == null || newV === '') ? '' : String(newV);
        if (oldStr !== newStr) {
          if (noteFields.includes(f)) {
            prevVals[f] = summariseNotes(oldV as string);
            newVals[f] = summariseNotes(newV as string);
          } else {
            prevVals[f] = oldV ?? null; newVals[f] = newV ?? null;
          }
        }
      }

      let auditWarning: string | undefined;
      if (Object.keys(newVals).length > 0) {
        const isStatusChange = prevVals.status !== undefined;
        auditWarning = await logAuditSafe({
          entityType: 'Job', entityId: input.id,
          action: isStatusChange ? 'job_status_changed' : 'job_edited',
          performedBy: context.user.email,
          summary: `Job #${existing.jobId} ${isStatusChange ? `status changed: ${prevVals.status} → ${newVals.status}` : 'edited'}`,
          previousValues: prevVals, newValues: newVals,
        });
      }
      return { success: true, id: input.id, warning, auditWarning };
    }

    // CREATE
    // Actual timestamps for new jobs created directly as In Progress / Completed
    const ts = buildActualTimestampFields(status, {});
    Object.assign(record, ts.record);

    const rec = await Jobs.create({ record });
    const auditWarning = await logAuditSafe({
      entityType: 'Job', entityId: rec.id, action: 'job_created',
      performedBy: context.user.email,
      summary: `Job created: ${input.service} on ${input.jobDate} (${status})`,
      newValues: {
        service: input.service, jobDate: input.jobDate, status, amountCharged: input.amountCharged ?? 0,
        customer: input.customer, ...(quoteNumber ? { quoteNumber } : {}), ...ts.auditNew,
      },
    });
    return { success: true, id: rec.id, warning, auditWarning };
  },
});
