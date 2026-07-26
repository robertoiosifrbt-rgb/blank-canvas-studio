import { z } from 'zod';
import { createEndpoint, Payments, Customers, Jobs, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { paymentRecordSchema } from '../lib/zodSchemas';
import { extractId } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional(), customerId: z.string().optional(), jobId: z.string().optional() }),
  outputSchema: z.object({ records: z.array(paymentRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    const filters: Record<string, string> = {};
    if (input.customerId) filters.customer = input.customerId;
    if (input.jobId) filters.job = input.jobId;

    const [allPayments, allCusts, allJobs] = await Promise.all([
      fetchAll((p) => Payments.findAll(p), Object.keys(filters).length ? { filters } : undefined),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
      fetchAll((p) => Jobs.findAll(p), { fields: ['id', 'jobId', 'service'] }),
    ]);

    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });
    const jobMap: Record<string, string> = {};
    allJobs.forEach(j => { jobMap[j.id] = `#${j.jobId} — ${j.service ?? ''}`; });

    let records = allPayments.map(p => {
      const custId = extractId(p.customer);
      const jobId = extractId(p.job);
      return { ...p, customerName: custMap[custId ?? ''] ?? '', jobLabel: jobMap[jobId ?? ''] ?? '' };
    });

    if (input.search) {
      const q = input.search.toLowerCase();
      records = records.filter(r =>
        (r.customerName ?? '').toLowerCase().includes(q) ||
        (r.jobLabel ?? '').toLowerCase().includes(q) ||
        (r.externalReference ?? '').toLowerCase().includes(q)
      );
    }

    return { records: records.sort((a, b) => defaultSort(a, b, 'paymentId')) };
  },
});
