import { z } from 'zod';
import { createEndpoint, JobAssignments, Jobs, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';
import { extractId } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const existing = await JobAssignments.findOne({ id: input.id });
    if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Assignment not found' });

    const jobId = extractId(existing.job);
    const cleanerId = extractId(existing.cleaner);
    let jobLabel = '';
    let cleanerName = '';
    if (jobId) { const job = await Jobs.findOne({ id: jobId, fields: ['id', 'jobId'] }); if (job) jobLabel = `Job #${job.jobId}`; }
    if (cleanerId) { const cleaner = await Cleaners.findOne({ id: cleanerId, fields: ['id', 'cleanerName'] }); if (cleaner) cleanerName = cleaner.cleanerName ?? ''; }

    await JobAssignments.delete({ id: input.id });

    const auditWarning = await logAuditSafe({
      entityType: 'JobAssignment', entityId: input.id, action: 'assignment_deleted',
      performedBy: context.user.email,
      summary: `Assignment removed: ${cleanerName} from ${jobLabel}`,
      previousValues: { jobId, cleanerId, assignmentRole: existing.assignmentRole, assignedDate: existing.assignedDate },
    });
    return { success: true, auditWarning };
  },
});
