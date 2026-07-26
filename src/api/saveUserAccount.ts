import { z } from 'zod';
import { createEndpoint, UserAccounts, Customers, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { sanitize, LIMITS } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    email: z.string().min(1).max(LIMITS.email),
    firstName: z.string().max(LIMITS.firstName).optional(),
    lastName: z.string().max(LIMITS.lastName).optional(),
    role: z.enum(['Admin', 'Cleaner', 'Customer']),
    customer: z.string().optional(),
    cleaner: z.string().optional(),
    active: z.boolean().optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), message: z.string().optional(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid email format' });

    const { records: emailMatches } = await UserAccounts.findAll({ filters: { email }, limit: 10 });
    const otherMatches = emailMatches.filter(r => r.id !== input.id);
    if (otherMatches.length > 1) throw new ZiteError({ code: 'CONFLICT', message: `Multiple user accounts already exist for ${email}. Resolve duplicates before making changes.` });
    if (otherMatches.length === 1) throw new ZiteError({ code: 'CONFLICT', message: 'A user account with this email already exists' });

    const isActive = input.active ?? true;

    if (input.role === 'Admin' && (input.customer || input.cleaner)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Admin accounts cannot be linked to Customer or Cleaner records.' });
    if (input.customer) { const c = await Customers.findOne({ id: input.customer, fields: ['id'] }); if (!c) throw new ZiteError({ code: 'BAD_REQUEST', message: 'The selected Customer record does not exist.' }); }
    if (input.cleaner) { const c = await Cleaners.findOne({ id: input.cleaner, fields: ['id'] }); if (!c) throw new ZiteError({ code: 'BAD_REQUEST', message: 'The selected Cleaner record does not exist.' }); }
    if (isActive && input.role === 'Customer') {
      if (!input.customer) throw new ZiteError({ code: 'BAD_REQUEST', message: 'An active Customer account must be linked to a Customer record.' });
      if (input.cleaner) throw new ZiteError({ code: 'BAD_REQUEST', message: 'A Customer account cannot be linked to a Cleaner record.' });
    }
    if (isActive && input.role === 'Cleaner') {
      if (!input.cleaner) throw new ZiteError({ code: 'BAD_REQUEST', message: 'An active Cleaner account must be linked to a Cleaner record.' });
      if (input.customer) throw new ZiteError({ code: 'BAD_REQUEST', message: 'A Cleaner account cannot be linked to a Customer record.' });
    }
    if (!isActive) {
      if (input.role === 'Customer' && input.cleaner) throw new ZiteError({ code: 'BAD_REQUEST', message: 'A Customer account cannot be linked to a Cleaner record.' });
      if (input.role === 'Cleaner' && input.customer) throw new ZiteError({ code: 'BAD_REQUEST', message: 'A Cleaner account cannot be linked to a Customer record.' });
    }

    const record: Record<string, unknown> = {
      email, firstName: sanitize(input.firstName, LIMITS.firstName),
      lastName: sanitize(input.lastName, LIMITS.lastName),
      role: input.role, active: isActive,
    };
    if (input.role === 'Customer') { record.customer = input.customer || undefined; record.cleaner = undefined; }
    else if (input.role === 'Cleaner') { record.cleaner = input.cleaner || undefined; record.customer = undefined; }
    else { record.customer = undefined; record.cleaner = undefined; }

    if (input.id) {
      const existing = await UserAccounts.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'User account not found' });

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.userAccount);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      await UserAccounts.update({ id: input.id, record });

      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      const fields = ['email', 'firstName', 'lastName', 'role', 'active', 'customer', 'cleaner'] as const;
      for (const f of fields) {
        const oldV = f === 'customer' || f === 'cleaner'
          ? (Array.isArray((existing as any)[f]) ? (existing as any)[f][0] : (existing as any)[f])
          : (existing as any)[f];
        if (String(oldV ?? '') !== String(record[f] ?? '')) { prevVals[f] = oldV; newVals[f] = record[f]; }
      }
      let auditWarning: string | undefined;
      if (Object.keys(newVals).length > 0) {
        let action: Parameters<typeof logAuditSafe>[0]['action'] = 'useraccount_edited';
        if (prevVals.role !== undefined) action = 'useraccount_role_changed';
        else if (prevVals.active !== undefined) action = isActive ? 'useraccount_activated' : 'useraccount_deactivated';
        else if (prevVals.customer !== undefined) action = 'useraccount_customer_linked';
        else if (prevVals.cleaner !== undefined) action = 'useraccount_cleaner_linked';
        auditWarning = await logAuditSafe({
          entityType: 'UserAccount', entityId: input.id, action,
          performedBy: context.user.email,
          summary: `User account ${email} ${action.replace('useraccount_', '').replace(/_/g, ' ')}`,
          previousValues: prevVals, newValues: newVals,
        });
      }
      return { success: true, id: input.id, auditWarning };
    }

    const rec = await UserAccounts.create({ record });
    const auditWarning = await logAuditSafe({
      entityType: 'UserAccount', entityId: rec.id, action: 'useraccount_created',
      performedBy: context.user.email,
      summary: `User account created: ${email} (${input.role})`,
      newValues: { email, role: input.role, active: isActive },
    });
    return {
      success: true, id: rec.id, auditWarning,
      message: 'User record created. The person must sign up with the same email address to access the app. Their role and permissions will be preserved.',
    };
  },
});
