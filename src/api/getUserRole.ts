import { z } from 'zod';
import { createEndpoint, UserAccounts, Customers, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { normalizeEmail, extractId } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';

const REPAIR_META = { automaticRepair: true, source: 'getUserRole' } as const;

function differs(a: unknown, b: unknown): boolean {
  const sa = (a == null || a === '') ? '' : String(a);
  const sb = (b == null || b === '') ? '' : String(b);
  return sa !== sb;
}

async function updateIfChanged(
  id: string,
  current: Record<string, unknown>,
  desired: Record<string, unknown>,
): Promise<{ changed: Record<string, { from: unknown; to: unknown }> }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, val] of Object.entries(desired)) {
    const cur = current[key];
    if (differs(cur, val)) {
      changed[key] = { from: cur ?? null, to: val ?? null };
    }
  }
  if (Object.keys(changed).length > 0) {
    await UserAccounts.update({ id, record: desired });
  }
  return { changed };
}

function changedToPrevNew(changed: Record<string, { from: unknown; to: unknown }>): { prev: Record<string, unknown>; nv: Record<string, unknown> } {
  const prev: Record<string, unknown> = {};
  const nv: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changed)) { prev[k] = v.from; nv[k] = v.to; }
  return { prev, nv };
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    role: z.string().nullable(),
    active: z.boolean(),
    customerId: z.string().nullable(),
    cleanerId: z.string().nullable(),
    configError: z.string().nullable().optional(),
    auditWarning: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const normalizedEmail = normalizeEmail(context.user.email);
    const existingRole = context.user.role;
    const existingCustomerId = extractId(context.user.customer);
    const existingCleanerId = extractId(context.user.cleaner);
    const isActive = context.user.active ?? false;
    const userEmail = context.user.email;

    // ACHU-073: Aggregate audit warnings instead of silent best-effort
    const auditWarnings: string[] = [];
    async function auditSafe(params: Parameters<typeof logAuditSafe>[0]): Promise<void> {
      const w = await logAuditSafe(params);
      if (w) auditWarnings.push(w);
    }
    function result(base: { role: string | null; active: boolean; customerId: string | null; cleanerId: string | null; configError: string | null }) {
      return { ...base, auditWarning: auditWarnings.length > 0 ? auditWarnings.join(' | ') : undefined };
    }

    function buildLinkCleanup(role: string, custId: string | null, cleanId: string | null): Record<string, unknown> | null {
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;
      if (role === 'Admin') {
        if (custId) { updates.customer = ''; needsUpdate = true; }
        if (cleanId) { updates.cleaner = ''; needsUpdate = true; }
      } else if (role === 'Cleaner') {
        if (custId) { updates.customer = ''; needsUpdate = true; }
      } else if (role === 'Customer') {
        if (cleanId) { updates.cleaner = ''; needsUpdate = true; }
      }
      return needsUpdate ? updates : null;
    }

    async function validateCleanerLink(cleanerId: string): Promise<{ exists: boolean; active: boolean }> {
      const rec = await Cleaners.findOne({ id: cleanerId, fields: ['id', 'active'] });
      return { exists: !!rec, active: rec?.active ?? false };
    }

    async function validateCustomerLink(customerId: string): Promise<boolean> {
      const rec = await Customers.findOne({ id: customerId, fields: ['id'] });
      return !!rec;
    }

    const allWithEmail = await UserAccounts.findAll({ filters: { email: normalizedEmail }, limit: 50 });
    const allWithOrigEmail = await UserAccounts.findAll({ filters: { email: context.user.email }, limit: 50 });
    const seenIds = new Set<string>();
    const allMatched: typeof allWithEmail.records = [];
    for (const r of [...allWithEmail.records, ...allWithOrigEmail.records]) {
      if (!seenIds.has(r.id)) { seenIds.add(r.id); allMatched.push(r); }
    }

    const preparedRecords = allMatched.filter(r => r.id !== context.user.id);

    if (preparedRecords.length > 1) {
      console.warn(`[getUserRole] Multiple prepared accounts for email hash. Record IDs: ${preparedRecords.map(r => r.id).join(', ')}`);
      return result({ role: existingRole ?? null, active: false, customerId: null, cleanerId: null, configError: 'Multiple account records exist for this email. Please contact an administrator.' });
    }

    const preparedRecord = preparedRecords.length === 1 ? preparedRecords[0] : null;

    if (preparedRecord) {
      const authAlreadyConfigured = !!existingRole && isActive && (
        existingRole === 'Admin' ||
        (existingRole === 'Cleaner' && !!existingCleanerId) ||
        (existingRole === 'Customer' && !!existingCustomerId)
      );
      if (authAlreadyConfigured) {
        if (preparedRecord.active !== false) {
          await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
          await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared account deactivated — authenticated account already configured', previousValues: { active: true }, newValues: { active: false }, metadata: REPAIR_META });
        }
      } else {
        const preparedRole = preparedRecord.role || 'Customer';
        const preparedActive = preparedRecord.active ?? true;
        const preparedCustomer = extractId(preparedRecord.customer);
        const preparedCleaner = extractId(preparedRecord.cleaner);

        if (preparedRole === 'Admin') {
          if (preparedCustomer || preparedCleaner) {
            console.warn(`[getUserRole] Prepared Admin account has profile links. ID: ${preparedRecord.id}`);
          }
          const desired: Record<string, unknown> = { role: 'Admin', active: preparedActive, customer: '', cleaner: '' };
          if (preparedRecord.firstName) desired.firstName = preparedRecord.firstName;
          if (preparedRecord.lastName) desired.lastName = preparedRecord.lastName;
          const currentAuth: Record<string, unknown> = { role: existingRole, active: isActive, customer: existingCustomerId ?? '', cleaner: existingCleanerId ?? '', firstName: context.user.firstName, lastName: context.user.lastName };
          const { changed } = await updateIfChanged(context.user.id, currentAuth, desired);
          if (preparedRecord.active !== false) {
            await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
            await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared account deactivated after merge', previousValues: { active: true }, newValues: { active: false }, metadata: REPAIR_META });
          }
          if (Object.keys(changed).length > 0) {
            const { prev, nv } = changedToPrevNew(changed);
            await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Account configured as Admin from prepared record', previousValues: prev, newValues: nv, metadata: REPAIR_META });
          }
          return result({ role: 'Admin', active: preparedActive, customerId: null, cleanerId: null, configError: null });
        }

        if (preparedRole === 'Cleaner') {
          if (preparedCustomer) console.warn(`[getUserRole] Prepared Cleaner has customer link. ID: ${preparedRecord.id}`);
          if (!preparedCleaner) {
            if (preparedRecord.active !== false) {
              await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
              await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared Cleaner deactivated — no Cleaner link', previousValues: { active: preparedRecord.active ?? true }, newValues: { active: false }, metadata: REPAIR_META });
            }
            return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: null, configError: 'Prepared Cleaner account has no Cleaner link. Contact Admin.' });
          }
          const cleanerCheck = await validateCleanerLink(preparedCleaner);
          if (!cleanerCheck.exists) {
            if (preparedRecord.active !== false) {
              await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
              await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared Cleaner deactivated — linked Cleaner record missing', previousValues: { active: preparedRecord.active ?? true }, newValues: { active: false }, metadata: REPAIR_META });
            }
            return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: null, configError: 'Prepared Cleaner account links to a missing Cleaner record. Contact Admin.' });
          }
          if (!cleanerCheck.active) {
            if (preparedRecord.active !== false) {
              await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
              await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared Cleaner deactivated — linked Cleaner inactive', previousValues: { active: preparedRecord.active ?? true }, newValues: { active: false }, metadata: REPAIR_META });
            }
            return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: preparedCleaner, configError: 'Linked Cleaner record is inactive. Contact Admin.' });
          }
          const desired: Record<string, unknown> = { role: 'Cleaner', active: preparedActive, cleaner: preparedCleaner, customer: '' };
          if (preparedRecord.firstName) desired.firstName = preparedRecord.firstName;
          if (preparedRecord.lastName) desired.lastName = preparedRecord.lastName;
          const currentAuth: Record<string, unknown> = { role: existingRole, active: isActive, cleaner: existingCleanerId ?? '', customer: existingCustomerId ?? '', firstName: context.user.firstName, lastName: context.user.lastName };
          const { changed } = await updateIfChanged(context.user.id, currentAuth, desired);
          if (preparedRecord.active !== false) {
            await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
            await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared account deactivated after merge', previousValues: { active: true }, newValues: { active: false }, metadata: REPAIR_META });
          }
          if (Object.keys(changed).length > 0) {
            const { prev, nv } = changedToPrevNew(changed);
            await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Account configured as Cleaner from prepared record', previousValues: prev, newValues: nv, metadata: REPAIR_META });
          }
          return result({ role: 'Cleaner', active: preparedActive, customerId: null, cleanerId: preparedCleaner, configError: null });
        }

        if (preparedRole === 'Customer') {
          if (preparedCleaner) console.warn(`[getUserRole] Prepared Customer has cleaner link. ID: ${preparedRecord.id}`);
          let resolvedCustomerId = preparedCustomer;
          if (!resolvedCustomerId) {
            let custRec = await Customers.findOne({ filters: { email: normalizedEmail } });
            if (!custRec) custRec = await Customers.findOne({ filters: { email: context.user.email } });
            if (custRec) {
              resolvedCustomerId = custRec.id;
            } else {
              if (preparedRecord.active !== false) {
                await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
                await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared Customer deactivated — no Customer link resolvable', previousValues: { active: preparedRecord.active ?? true }, newValues: { active: false }, metadata: REPAIR_META });
              }
              return result({ role: 'Customer', active: false, customerId: null, cleanerId: null, configError: 'Prepared Customer account has no Customer link and none could be resolved. Contact Admin.' });
            }
          } else {
            const custExists = await validateCustomerLink(resolvedCustomerId);
            if (!custExists) {
              if (preparedRecord.active !== false) {
                await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
                await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared Customer deactivated — linked Customer record missing', previousValues: { active: preparedRecord.active ?? true }, newValues: { active: false }, metadata: REPAIR_META });
              }
              return result({ role: 'Customer', active: false, customerId: null, cleanerId: null, configError: 'Prepared Customer account links to a missing Customer record. Contact Admin.' });
            }
          }
          const desired: Record<string, unknown> = { role: 'Customer', active: preparedActive, customer: resolvedCustomerId, cleaner: '' };
          if (preparedRecord.firstName) desired.firstName = preparedRecord.firstName;
          if (preparedRecord.lastName) desired.lastName = preparedRecord.lastName;
          const currentAuth: Record<string, unknown> = { role: existingRole, active: isActive, customer: existingCustomerId ?? '', cleaner: existingCleanerId ?? '', firstName: context.user.firstName, lastName: context.user.lastName };
          const { changed } = await updateIfChanged(context.user.id, currentAuth, desired);
          if (preparedRecord.active !== false) {
            await UserAccounts.update({ id: preparedRecord.id, record: { active: false } });
            await auditSafe({ entityType: 'UserAccount', entityId: preparedRecord.id, action: 'useraccount_deactivated', performedBy: userEmail, summary: 'Prepared account deactivated after merge', previousValues: { active: true }, newValues: { active: false }, metadata: REPAIR_META });
          }
          if (Object.keys(changed).length > 0) {
            const { prev, nv } = changedToPrevNew(changed);
            await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Account configured as Customer from prepared record', previousValues: prev, newValues: nv, metadata: REPAIR_META });
          }
          return result({ role: 'Customer', active: preparedActive, customerId: resolvedCustomerId, cleanerId: null, configError: null });
        }

        return result({ role: preparedRole, active: false, customerId: null, cleanerId: null, configError: `Unknown prepared account role "${preparedRole}". Contact Admin.` });
      }
    }

    // ─── EXISTING ADMIN ───
    if (existingRole === 'Admin') {
      const cleanup = buildLinkCleanup('Admin', existingCustomerId, existingCleanerId);
      if (cleanup) {
        await UserAccounts.update({ id: context.user.id, record: cleanup });
        const prev: Record<string, unknown> = {};
        const nv: Record<string, unknown> = {};
        if (cleanup.customer !== undefined) { prev.customer = existingCustomerId; nv.customer = ''; }
        if (cleanup.cleaner !== undefined) { prev.cleaner = existingCleanerId; nv.cleaner = ''; }
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Incompatible links removed from Admin account', previousValues: prev, newValues: nv, metadata: REPAIR_META });
      }
      return result({ role: 'Admin', active: isActive, customerId: null, cleanerId: null, configError: null });
    }

    // ─── EXISTING CLEANER ───
    if (existingRole === 'Cleaner') {
      const cleanup = buildLinkCleanup('Cleaner', existingCustomerId, existingCleanerId);
      if (cleanup) {
        await UserAccounts.update({ id: context.user.id, record: cleanup });
        const prev: Record<string, unknown> = {};
        const nv: Record<string, unknown> = {};
        if (cleanup.customer !== undefined) { prev.customer = existingCustomerId; nv.customer = ''; }
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Incompatible customer link removed from Cleaner account', previousValues: prev, newValues: nv, metadata: REPAIR_META });
      }
      if (!isActive) return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: existingCleanerId, configError: null });
      if (!existingCleanerId) return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: null, configError: 'Active Cleaner account has no Cleaner link. Contact Admin to fix your account.' });
      const cleanerCheck = await validateCleanerLink(existingCleanerId);
      if (!cleanerCheck.exists) return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: existingCleanerId, configError: 'Your linked Cleaner record no longer exists. Contact Admin.' });
      if (!cleanerCheck.active) return result({ role: 'Cleaner', active: false, customerId: null, cleanerId: existingCleanerId, configError: 'Your linked Cleaner record is inactive. Contact Admin.' });
      return result({ role: 'Cleaner', active: true, customerId: null, cleanerId: existingCleanerId, configError: null });
    }

    // ─── EXISTING CUSTOMER ───
    if (existingRole === 'Customer' && existingCustomerId) {
      const cleanup = buildLinkCleanup('Customer', existingCustomerId, existingCleanerId);
      if (cleanup) {
        await UserAccounts.update({ id: context.user.id, record: cleanup });
        const prev: Record<string, unknown> = {};
        const nv: Record<string, unknown> = {};
        if (cleanup.cleaner !== undefined) { prev.cleaner = existingCleanerId; nv.cleaner = ''; }
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Incompatible cleaner link removed from Customer account', previousValues: prev, newValues: nv, metadata: REPAIR_META });
      }
      if (!isActive) return result({ role: 'Customer', active: false, customerId: existingCustomerId, cleanerId: null, configError: null });
      const custExists = await validateCustomerLink(existingCustomerId);
      if (!custExists) {
        let repairedCust = await Customers.findOne({ filters: { email: normalizedEmail } });
        if (!repairedCust) repairedCust = await Customers.findOne({ filters: { email: context.user.email } });
        if (repairedCust) {
          await UserAccounts.update({ id: context.user.id, record: { customer: repairedCust.id } });
          await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_customer_linked', performedBy: userEmail, summary: 'Customer link repaired automatically', previousValues: { customer: existingCustomerId }, newValues: { customer: repairedCust.id }, metadata: REPAIR_META });
          return result({ role: 'Customer', active: isActive, customerId: repairedCust.id, cleanerId: null, configError: null });
        }
        return result({ role: 'Customer', active: false, customerId: null, cleanerId: null, configError: 'Your linked Customer record no longer exists. Contact Admin.' });
      }
      return result({ role: 'Customer', active: true, customerId: existingCustomerId, cleanerId: null, configError: null });
    }

    // ─── NEW SIGNUP or customer with missing link ───
    const needsCustomerLink = !existingRole || (existingRole === 'Customer' && !existingCustomerId);
    if (needsCustomerLink) {
      let customerRecord = await Customers.findOne({ filters: { email: normalizedEmail } });
      if (!customerRecord) customerRecord = await Customers.findOne({ filters: { email: context.user.email } });
      if (!customerRecord) {
        const name = [context.user.firstName, context.user.lastName].filter(Boolean).join(' ') || normalizedEmail;
        customerRecord = await Customers.create({ record: { customerName: name, email: normalizedEmail, status: 'Active' } });
        await auditSafe({ entityType: 'Customer', entityId: customerRecord.id, action: 'customer_created', performedBy: userEmail, summary: 'Customer created automatically during signup', metadata: REPAIR_META });
      }
      const desired: Record<string, unknown> = { role: 'Customer', active: true, customer: customerRecord.id };
      const currentAuth: Record<string, unknown> = { role: existingRole ?? '', active: isActive, customer: existingCustomerId ?? '' };
      const { changed } = await updateIfChanged(context.user.id, currentAuth, desired);
      if (Object.keys(changed).length > 0) {
        const { prev, nv } = changedToPrevNew(changed);
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Account configured as Customer during signup', previousValues: prev, newValues: nv, metadata: REPAIR_META });
      }
      return result({ role: 'Customer', active: true, customerId: customerRecord.id, cleanerId: null, configError: null });
    }

    // Legacy account with both links — enforce rules
    if (existingCustomerId && existingCleanerId) {
      if (existingRole === 'Cleaner') {
        await UserAccounts.update({ id: context.user.id, record: { customer: '' } });
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Incompatible customer link removed from legacy Cleaner account', previousValues: { customer: existingCustomerId }, newValues: { customer: '' }, metadata: REPAIR_META });
      } else {
        await UserAccounts.update({ id: context.user.id, record: { cleaner: '' } });
        await auditSafe({ entityType: 'UserAccount', entityId: context.user.id, action: 'useraccount_edited', performedBy: userEmail, summary: 'Incompatible cleaner link removed from legacy account', previousValues: { cleaner: existingCleanerId }, newValues: { cleaner: '' }, metadata: REPAIR_META });
      }
    }

    return result({ role: existingRole ?? null, active: isActive, customerId: existingCustomerId, cleanerId: existingCleanerId, configError: null });
  },
});
