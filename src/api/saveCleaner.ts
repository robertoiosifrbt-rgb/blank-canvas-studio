import { z } from 'zod';
import { createEndpoint, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';
import { summariseNotes } from '../lib/validation';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    cleanerName: z.string().min(1, 'Cleaner name is required').max(200),
    phone: z.string().max(30).optional(),
    email: z.string().max(254).optional(),
    active: z.boolean().optional(),
    notes: z.string().max(5000).optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const email = input.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid email format' });
    if (email) {
      const existing = await Cleaners.findOne({ filters: { email } });
      if (existing && existing.id !== input.id) throw new ZiteError({ code: 'CONFLICT', message: 'A cleaner with this email already exists' });
    }

    const isActive = input.active ?? true;
    const record: Record<string, unknown> = {
      cleanerName: input.cleanerName.trim(),
      phone: input.phone?.trim() || undefined, email,
      active: isActive, notes: input.notes?.trim() || undefined,
    };

    if (input.id) {
      const existing = await Cleaners.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Cleaner not found' });

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.cleaner);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      await Cleaners.update({ id: input.id, record });

      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      const fields = ['cleanerName', 'phone', 'email', 'active', 'notes'] as const;
      for (const f of fields) {
        const oldStr = String(existing[f] ?? '');
        const newStr = String(record[f] ?? '');
        if (oldStr !== newStr) {
          if (f === 'notes') {
            prevVals[f] = summariseNotes(existing[f] as string);
            newVals[f] = summariseNotes(record[f] as string);
          } else {
            prevVals[f] = existing[f]; newVals[f] = record[f];
          }
        }
      }
      let auditWarning: string | undefined;
      if (Object.keys(newVals).length > 0) {
        const activationChange = prevVals.active !== undefined;
        auditWarning = await logAuditSafe({
          entityType: 'Cleaner', entityId: input.id,
          action: activationChange ? (isActive ? 'cleaner_activated' : 'cleaner_deactivated') : 'cleaner_edited',
          performedBy: context.user.email,
          summary: `Cleaner "${existing.cleanerName}" ${activationChange ? (isActive ? 'activated' : 'deactivated') : 'edited'}`,
          previousValues: prevVals, newValues: newVals,
        });
      }
      return { success: true, id: input.id, auditWarning };
    }

    const rec = await Cleaners.create({ record });
    const auditWarning = await logAuditSafe({
      entityType: 'Cleaner', entityId: rec.id, action: 'cleaner_created',
      performedBy: context.user.email,
      summary: `Cleaner created: ${input.cleanerName.trim()}`,
      newValues: { cleanerName: input.cleanerName.trim(), email, active: isActive, ...(input.notes?.trim() ? { notes: summariseNotes(input.notes) } : {}) },
    });
    return { success: true, id: rec.id, auditWarning };
  },
});
