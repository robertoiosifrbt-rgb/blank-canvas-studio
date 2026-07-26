import { z } from 'zod';
import { createEndpoint, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';
import { VALID_CUSTOMER_TYPES as VALID_TYPES, VALID_CUSTOMER_STATUSES as VALID_STATUSES, summariseNotes } from '../lib/validation';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    customerName: z.string().min(1, 'Customer name is required').max(200),
    phone: z.string().max(30).optional(),
    email: z.string().max(254).optional(),
    address: z.string().max(500).optional(),
    postcode: z.string().max(20).optional(),
    customerType: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().max(5000).optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const email = input.email?.trim().toLowerCase() || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid email format' });

    if (email) {
      const existing = await Customers.findOne({ filters: { email } });
      if (existing && existing.id !== input.id) throw new ZiteError({ code: 'CONFLICT', message: 'A customer with this email already exists' });
    }
    if (input.customerType && !VALID_TYPES.includes(input.customerType)) throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid customer type: ${input.customerType}` });
    if (input.status && !VALID_STATUSES.includes(input.status)) throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid status: ${input.status}` });

    const record: Record<string, unknown> = {
      customerName: input.customerName.trim(),
      phone: input.phone?.trim() || undefined, email,
      address: input.address?.trim() || undefined,
      postcode: input.postcode?.trim() || undefined,
      customerType: input.customerType || undefined,
      status: input.status || 'Lead',
      notes: input.notes?.trim() || undefined,
    };

    if (input.id) {
      const existing = await Customers.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Customer not found' });

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.customer);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      await Customers.update({ id: input.id, record });

      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      const fields = ['customerName', 'phone', 'email', 'address', 'postcode', 'customerType', 'status', 'notes'] as const;
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
        const isStatusChange = prevVals.status !== undefined;
        auditWarning = await logAuditSafe({
          entityType: 'Customer', entityId: input.id,
          action: isStatusChange ? 'customer_status_changed' : 'customer_edited',
          performedBy: context.user.email,
          summary: `Customer "${existing.customerName}" ${isStatusChange ? `status: ${prevVals.status} → ${newVals.status}` : 'edited'}`,
          previousValues: prevVals, newValues: newVals,
        });
      }
      return { success: true, id: input.id, auditWarning };
    }

    const rec = await Customers.create({ record });
    const auditWarning = await logAuditSafe({
      entityType: 'Customer', entityId: rec.id, action: 'customer_created',
      performedBy: context.user.email,
      summary: `Customer created: ${input.customerName.trim()}`,
      newValues: { customerName: input.customerName.trim(), email, status: input.status || 'Lead', ...(input.notes?.trim() ? { notes: summariseNotes(input.notes) } : {}) },
    });
    return { success: true, id: rec.id, auditWarning };
  },
});
