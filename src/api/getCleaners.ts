import { z } from 'zod';
import { createEndpoint, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { cleanerRecordSchema } from '../lib/zodSchemas';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({ records: z.array(cleanerRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    let records = await fetchAll((p) => Cleaners.findAll(p));
    if (input.search) {
      const q = input.search.toLowerCase();
      records = records.filter(r => (r.cleanerName ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q));
    }
    return { records: records.sort((a, b) => defaultSort(a, b, 'cleanerId')) };
  },
});
