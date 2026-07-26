import { z } from 'zod';
import { createEndpoint, FinancialSettings, ZiteError } from 'zite-integrations-backend-sdk';
import { isValidDate, sanitize, LIMITS } from '../lib/validation';
import { SETTINGS_KEY } from '../lib/financialSettingsHelper';
import { logAuditSafe } from '../lib/audit';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    taxReserve: z.number().min(0).max(1),
    nationalInsuranceReserve: z.number().min(0).max(1),
    emergencyReserve: z.number().min(0).max(1),
    taxYearStart: z.string().optional(),
    taxYearEnd: z.string().optional(),
    taxYearMode: z.enum(['Automatic', 'Manual']).optional(),
    notes: z.string().max(LIMITS.notes).optional(),
    active: z.boolean().optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional(), auditWarnings: z.array(z.string()).optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ACHU-125: Exact 100% limit using integer basis points (precision-safe)
    const totalBasisPoints = Math.round(input.taxReserve * 10000) + Math.round(input.nationalInsuranceReserve * 10000) + Math.round(input.emergencyReserve * 10000);
    if (totalBasisPoints > 10000) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: `Total reserve percentages cannot exceed 100.0%. Current total: ${(totalBasisPoints / 100).toFixed(1)}%`,
      });
    }

    // ─── ACHU-032: Tax year mode handling ───
    const mode = input.taxYearMode ?? 'Manual';
    let taxYearStart: string | undefined;
    let taxYearEnd: string | undefined;

    if (mode === 'Automatic') {
      taxYearStart = undefined;
      taxYearEnd = undefined;
    } else {
      if (!input.taxYearStart || !input.taxYearEnd) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Manual tax year mode requires both start and end dates.' });
      }
      if (!isValidDate(input.taxYearStart)) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Tax year start is not a valid calendar date.' });
      }
      if (!isValidDate(input.taxYearEnd)) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Tax year end is not a valid calendar date.' });
      }
      if (input.taxYearStart >= input.taxYearEnd) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Tax year start must be before tax year end.' });
      }
      taxYearStart = input.taxYearStart;
      taxYearEnd = input.taxYearEnd;
    }

    const activeVal = input.active ?? true;

    const data: Record<string, unknown> = {
      taxReserve: input.taxReserve,
      nationalInsuranceReserve: input.nationalInsuranceReserve,
      emergencyReserve: input.emergencyReserve,
      taxYearStart,
      taxYearEnd,
      taxYearMode: mode,
      notes: sanitize(input.notes, LIMITS.notes),
      active: activeVal,
      settingsKey: SETTINGS_KEY,
    };

    // Fetch existing record for audit comparison
    const existingRecord = await FinancialSettings.findOne({ filters: { settingsKey: SETTINGS_KEY } });

    // ACHU-058: Optimistic concurrency — mandatory on updates
    if (existingRecord) {
      const revCheck = checkRevision(input._revision, existingRecord, REVISION_FIELDS.financialSettings);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'Financial settings have been modified by another user. Reload the latest version before saving.' });
    }

    // ─── ACHU-034: Atomic upsert via bulkCreate + matchOn: settingsKey ───
    const result = await FinancialSettings.bulkCreate({
      records: [data as any],
      matchOn: ['settingsKey'],
    });

    if (!result.success || result.records.length === 0) {
      throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Failed to save financial settings.' });
    }

    const savedId = result.records[0].id;

    // ACHU-074: Deactivate legacy duplicate active records with individual audit events
    const dupAuditWarnings: string[] = [];
    const { records: allActive } = await FinancialSettings.findAll({ filters: { active: true }, limit: 100 });
    const toDeactivate = allActive.filter(r => r.id !== savedId);
    for (const dup of toDeactivate) {
      // Only audit records that are genuinely changing from active to inactive
      if (dup.active === true) {
        await FinancialSettings.update({ id: dup.id, record: { active: false } });
        const w = await logAuditSafe({
          entityType: 'FinancialSettings', entityId: dup.id, action: 'financialsettings_deactivated',
          performedBy: context.user.email,
          summary: `Duplicate financial settings record deactivated (canonical: ${savedId})`,
          previousValues: { active: true },
          newValues: { active: false },
          metadata: { automaticCleanup: true, source: 'saveFinancialSettings', reason: 'duplicate_active_settings' },
        });
        if (w) dupAuditWarnings.push(w);
      }
    }

    // ─── Audit logging ───
    const AUDIT_FIELDS = [
      'taxReserve', 'nationalInsuranceReserve', 'emergencyReserve',
      'taxYearMode', 'taxYearStart', 'taxYearEnd', 'settingsKey', 'active', 'notes',
    ] as const;

    let auditWarning: string | undefined;
    if (existingRecord) {
      // Edit — compare old vs new
      const prevVals: Record<string, unknown> = {};
      const newVals: Record<string, unknown> = {};
      for (const f of AUDIT_FIELDS) {
        const oldV = (existingRecord as any)[f];
        const newV = data[f];
        const oldStr = (oldV == null || oldV === '') ? '' : String(oldV);
        const newStr = (newV == null || newV === '') ? '' : String(newV);
        if (oldStr !== newStr) { prevVals[f] = oldV ?? null; newVals[f] = newV ?? null; }
      }

      if (Object.keys(newVals).length > 0) {
        // Determine specific action
        const wasActive = existingRecord.active;
        let action: 'financialsettings_edited' | 'financialsettings_activated' | 'financialsettings_deactivated' = 'financialsettings_edited';
        if (wasActive === true && activeVal === false) action = 'financialsettings_deactivated';
        else if (wasActive === false && activeVal === true) action = 'financialsettings_activated';

        auditWarning = await logAuditSafe({
          entityType: 'FinancialSettings', entityId: savedId, action,
          performedBy: context.user.email,
          summary: `Financial settings ${action === 'financialsettings_activated' ? 'activated' : action === 'financialsettings_deactivated' ? 'deactivated' : 'updated'}`,
          previousValues: prevVals, newValues: newVals,
        });
      }
    } else {
      // Created
      auditWarning = await logAuditSafe({
        entityType: 'FinancialSettings', entityId: savedId, action: 'financialsettings_created',
        performedBy: context.user.email,
        summary: 'Financial settings created',
        newValues: {
          taxReserve: input.taxReserve, nationalInsuranceReserve: input.nationalInsuranceReserve,
          emergencyReserve: input.emergencyReserve, taxYearMode: mode, active: activeVal,
          ...(taxYearStart ? { taxYearStart } : {}), ...(taxYearEnd ? { taxYearEnd } : {}),
        },
      });
    }

    const allWarnings = [...(auditWarning ? [auditWarning] : []), ...dupAuditWarnings];
    return { success: true, id: savedId, auditWarning: allWarnings.length > 0 ? allWarnings.join(' | ') : undefined, auditWarnings: allWarnings.length > 0 ? allWarnings : undefined };
  },
});
