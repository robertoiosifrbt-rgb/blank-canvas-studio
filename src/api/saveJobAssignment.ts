import { z } from 'zod';
import { createEndpoint, JobAssignments, Jobs, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { sanitize, LIMITS, isValidDate } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';
import { ukToday } from '../lib/ukDate';

/**
 * ACHU-077: Validate assignedDate using the central real-calendar-date validator.
 * Returns a valid YYYY-MM-DD string or throws.
 */
function resolveAssignedDate(raw: string | null | undefined): string {
  // Genuinely omitted — default to current Europe/London date
  if (raw === undefined || raw === null) {
    return ukToday();
  }
  // Explicitly provided — must be a valid calendar date
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new ZiteError({ code: 'BAD_REQUEST', message: 'Assigned date cannot be empty. Omit the field to use today\'s date, or provide a valid YYYY-MM-DD date.' });
  }
  if (!isValidDate(trimmed)) {
    throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid assigned date: "${trimmed}". Must be a valid calendar date in YYYY-MM-DD format.` });
  }
  return trimmed;
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    jobId: z.string().min(1, 'Job is required'),
    cleanerId: z.string().min(1, 'Cleaner is required'),
    assignmentRole: z.string().max(LIMITS.assignmentRole).optional(),
    assignedDate: z.string().optional().nullable(),
    notes: z.string().max(LIMITS.notes).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const job = await Jobs.findOne({ id: input.jobId, fields: ['id', 'status', 'jobId'] });
    if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });

    // ACHU-097: Verify cleaner exists AND is active
    const cleaner = await Cleaners.findOne({ id: input.cleanerId, fields: ['id', 'active', 'cleanerName'] });
    if (!cleaner) throw new ZiteError({ code: 'NOT_FOUND', message: 'Cleaner not found' });
    if (!cleaner.active) throw new ZiteError({ code: 'BAD_REQUEST', message: `Cleaner "${cleaner.cleanerName}" is inactive and cannot be assigned to jobs.` });

    const cleanedRole = sanitize(input.assignmentRole, LIMITS.assignmentRole) ?? '';
    const uniqueKey = `${input.jobId}|${input.cleanerId}`;

    // ACHU-077: Validate assignedDate
    const assignedDate = resolveAssignedDate(input.assignedDate);

    if (input.id) {
      const existing = await JobAssignments.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Assignment not found' });

      // ACHU-097: Check for duplicate active assignments for the same job
      const existingDups = await JobAssignments.findAll({ filters: { assignmentUniqueKey: uniqueKey }, limit: 5 });
      const collision = existingDups.records.find(r => r.id !== input.id);
      if (collision) throw new ZiteError({ code: 'CONFLICT', message: 'This cleaner is already assigned to this job.' });

      await JobAssignments.update({
        id: input.id,
        record: { job: input.jobId, cleaner: input.cleanerId, assignmentRole: cleanedRole || undefined, assignedDate, notes: sanitize(input.notes, LIMITS.notes), assignmentUniqueKey: uniqueKey },
      });

      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      const oldJobId = Array.isArray(existing.job) ? existing.job[0] : existing.job;
      if (oldJobId !== input.jobId) { prevVals.job = oldJobId ?? null; newVals.job = input.jobId; }
      const oldCleanerId = Array.isArray(existing.cleaner) ? existing.cleaner[0] : existing.cleaner;
      if (oldCleanerId !== input.cleanerId) { prevVals.cleaner = oldCleanerId; newVals.cleaner = input.cleanerId; }
      if ((existing.assignmentRole ?? '') !== (cleanedRole || '')) { prevVals.assignmentRole = existing.assignmentRole ?? null; newVals.assignmentRole = cleanedRole; }
      if ((existing.assignedDate ?? '') !== assignedDate) { prevVals.assignedDate = existing.assignedDate ?? null; newVals.assignedDate = assignedDate; }
      const oldNotes = existing.notes ?? '';
      const newNotes = sanitize(input.notes, LIMITS.notes) ?? '';
      if (oldNotes !== newNotes) { prevVals.notes = existing.notes ?? null; newVals.notes = newNotes || null; }
      let auditWarning: string | undefined;
      if (Object.keys(newVals).length > 0) {
        auditWarning = await logAuditSafe({
          entityType: 'JobAssignment', entityId: input.id, action: 'assignment_edited',
          performedBy: context.user.email,
          summary: `Assignment for Job #${job.jobId} edited`,
          previousValues: prevVals, newValues: newVals,
        });
      }
      return { success: true, id: input.id, auditWarning };
    }

    // ACHU-097: Reject duplicate active assignment for the same job (new creation)
    const existingForJob = await JobAssignments.findAll({ filters: { assignmentUniqueKey: uniqueKey }, limit: 1 });
    if (existingForJob.records.length > 0) {
      throw new ZiteError({ code: 'CONFLICT', message: 'This cleaner is already assigned to this job.' });
    }

    const result = await JobAssignments.bulkCreate({
      records: [{ job: input.jobId, cleaner: input.cleanerId, assignmentRole: cleanedRole || undefined, assignedDate, notes: sanitize(input.notes, LIMITS.notes), assignmentUniqueKey: uniqueKey }],
      matchOn: ['assignmentUniqueKey'],
    });
    if (!result.success || result.records.length === 0) throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Failed to create assignment.' });
    const created = result.records[0];

    const auditWarning = await logAuditSafe({
      entityType: 'JobAssignment', entityId: created.id, action: 'assignment_created',
      performedBy: context.user.email,
      summary: `Cleaner "${cleaner.cleanerName}" assigned to Job #${job.jobId} as ${cleanedRole || 'Cleaner'}`,
      newValues: { jobId: input.jobId, cleanerId: input.cleanerId, assignmentRole: cleanedRole, assignedDate },
    });
    return { success: true, id: created.id, auditWarning };
  },
});
