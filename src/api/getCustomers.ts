import { z } from 'zod';
import { createEndpoint, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { customerRecordSchema } from '../lib/zodSchemas';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({ records: z.array(customerRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    let records = await fetchAll((p) => Customers.findAll(p));
    if (input.search) {
      const q = input.search.toLowerCase();
      records = records.filter(r =>
        (r.customerName ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q) ||
        (r.address ?? '').toLowerCase().includes(q)
      );
    }
    return { records: records.sort((a, b) => defaultSort(a, b, 'customerId')) };
  },
});
