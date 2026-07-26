import { z } from 'zod';
import { createEndpoint, Expenses, Jobs, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { expenseRecordSchema } from '../lib/zodSchemas';
import { extractId } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({ records: z.array(expenseRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const [allExpenses, allJobs, allCusts] = await Promise.all([
      fetchAll((p) => Expenses.findAll(p)),
      fetchAll((p) => Jobs.findAll(p), { fields: ['id', 'jobId', 'service', 'customer'] }),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
    ]);

    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });
    const jobMap: Record<string, { label: string }> = {};
    allJobs.forEach(j => {
      const cid = extractId(j.customer);
      const customerName = custMap[cid ?? ''] ?? '';
      jobMap[j.id] = { label: `#${j.jobId} — ${j.service ?? 'Job'} — ${customerName || 'Unknown'}` };
    });

    let records = allExpenses.map(e => {
      const ljid = extractId(e.linkedJob);
      const jobInfo = ljid ? jobMap[ljid] : undefined;
      return { ...e, linkedJobLabel: jobInfo?.label ?? '' };
    });

    if (input.search) {
      const q = input.search.toLowerCase();
      records = records.filter(r =>
        (r.supplier ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q)
      );
    }

    return { records: records.sort((a, b) => defaultSort(a, b, 'expenseId')) };
  },
});
