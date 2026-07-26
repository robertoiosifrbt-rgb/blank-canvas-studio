import { z } from 'zod';
import { createEndpoint, FinancialSettings, ZiteError } from 'zite-integrations-backend-sdk';
import { financialSettingsSchema } from '../lib/zodSchemas';
import { SETTINGS_KEY, resolveTaxYearRange } from '../lib/financialSettingsHelper';
import { ukToday } from '../lib/ukDate';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    settings: financialSettingsSchema.nullable(),
    all: z.array(financialSettingsSchema),
    resolvedTaxYear: z.object({ start: z.string(), end: z.string() }).optional(),
  }),
  execute: async ({ context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ACHU-034: Retrieve by settingsKey first, then fall back to active
    let canonical = await FinancialSettings.findOne({ filters: { settingsKey: SETTINGS_KEY } });
    if (!canonical) {
      // Legacy: find any active record
      canonical = await FinancialSettings.findOne({ filters: { active: true } });
    }

    const { records } = await FinancialSettings.findAll({ limit: 100 });

    // ACHU-032: Resolve tax year dynamically
    const todayStr = ukToday();
    const resolved = canonical ? resolveTaxYearRange(canonical, todayStr) : undefined;

    return {
      settings: canonical ?? null,
      all: records,
      resolvedTaxYear: resolved,
    };
  },
});
