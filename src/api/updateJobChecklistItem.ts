import { z } from 'zod';
import { createEndpoint, JobChecklistItems, JobAssignments, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { extractId } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';
import { reserveToken, completeToken, failToken, withRequestToken, type ReserveResult, type ReconcileFn } from '../lib/idempotency';

export default createEndpoint({
  authenticated: true,
  description: 'Update a single checklist item — Cleaner or Admin',
  inputSchema: z.object({
    checklistItemId: z.string().min(1),
    completed: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
    notApplicable: z.boolean().optional(),
    notApplicableReason: z.string().max(500).optional(),
    // ACHU-116: Idempotency token for safe retry
    requestToken: z.string().max(100).optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (!context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const isAdmin = context.user.role === 'Admin';
    const isCleaner = context.user.role === 'Cleaner';
    if (!isAdmin && !isCleaner) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // Load the checklist item
    const item = await JobChecklistItems.findOne({ id: input.checklistItemId });
    if (!item) throw new ZiteError({ code: 'NOT_FOUND', message: 'Checklist item not found' });

    const jobId = extractId(item.job);
    if (!jobId) throw new ZiteError({ code: 'NOT_FOUND', message: 'No linked job' });

    // ACHU-116: Reserve idempotency token before mutation (fail-closed)
    // Reconcile: re-read the checklist item to see if the mutation already took effect.
    let tokenReservation: ReserveResult | null = null;
    if (input.requestToken) {
      const reconcile: ReconcileFn = async () => {
        const fresh = await JobChecklistItems.findOne({ id: input.checklistItemId });
        if (!fresh) return { alreadyApplied: false };
        // Check each requested field — if all match, the mutation already occurred.
        if (input.completed !== undefined && fresh.completed !== input.completed) return { alreadyApplied: false };
        if (input.notApplicable !== undefined && fresh.notApplicable !== input.notApplicable) return { alreadyApplied: false };
        return { alreadyApplied: true, result: { success: true } };
      };
      tokenReservation = await reserveToken({
        requestToken: input.requestToken,
        entityId: input.checklistItemId,
        action: 'checklist_item_update',
        performedBy: context.user.email,
        reconcile,
      });
      if ('alreadyCompleted' in tokenReservation) return tokenReservation.result;
    }

    try {
    // Cleaner: verify assignment
    let cleanerName = context.user.email;
    if (isCleaner) {
      const cleanerId = extractId(context.user.cleaner);
      if (!cleanerId) throw new ZiteError({ code: 'FORBIDDEN', message: 'No cleaner record linked' });
      const cleaner = await Cleaners.findOne({ id: cleanerId, fields: ['id', 'active', 'cleanerName'] });
      if (!cleaner || !cleaner.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Your cleaner account is not active' });
      cleanerName = cleaner.cleanerName ?? context.user.email;
      const assignment = await JobAssignments.findOne({ filters: { job: jobId, cleaner: cleanerId } });
      if (!assignment) throw new ZiteError({ code: 'FORBIDDEN', message: 'You are not assigned to this job' });
    }

    const now = new Date().toISOString();
    const record: Record<string, unknown> = {};
    const prevValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    let action: 'job_edited' = 'job_edited';
    let summary = '';

    if (input.completed !== undefined) {
      prevValues.completed = item.completed;
      newValues.completed = input.completed;
      record.completed = input.completed;

      if (input.completed) {
        record.completedBy = cleanerName;
        record.completedAt = now;
        action = 'job_edited';
        summary = `Checklist item "${item.itemLabel}" completed by ${cleanerName}`;
      } else {
        record.completedBy = '';
        record.completedAt = null;
        summary = `Checklist item "${item.itemLabel}" reopened by ${cleanerName}`;
      }
    }

    if (input.notApplicable !== undefined) {
      prevValues.notApplicable = item.notApplicable;
      newValues.notApplicable = input.notApplicable;
      record.notApplicable = input.notApplicable;
      if (input.notApplicable) {
        record.notApplicableReason = input.notApplicableReason ?? '';
        summary = `Checklist item "${item.itemLabel}" marked N/A by ${cleanerName}`;
      } else {
        record.notApplicableReason = '';
        summary = `Checklist item "${item.itemLabel}" un-marked N/A by ${cleanerName}`;
      }
    }

    if (input.notes !== undefined) {
      record.notes = input.notes;
    }

    await JobChecklistItems.update({ id: input.checklistItemId, record });

    const auditWarning = await logAuditSafe({
      entityType: 'Job',
      entityId: jobId,
      action,
      performedBy: context.user.email,
      summary: summary || `Checklist item "${item.itemLabel}" updated`,
      previousValues: prevValues,
      newValues: { ...newValues, itemKey: item.itemKey },
      metadata: withRequestToken({ checklistItemId: input.checklistItemId, role: context.user.role }, input.requestToken),
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
