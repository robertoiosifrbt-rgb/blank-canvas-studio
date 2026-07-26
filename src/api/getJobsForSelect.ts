import { z } from 'zod';
import { createEndpoint, Jobs, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({
    jobs: z.array(z.object({
      id: z.string(),
      jobId: z.union([z.number(), z.string(), z.null()]).optional(),
      customerName: z.string(),
      service: z.string(),
      jobDate: z.string(),
    })),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const [allJobs, allCusts] = await Promise.all([
      fetchAll((p) => Jobs.findAll(p), { fields: ['id', 'jobId', 'customer', 'service', 'jobDate', 'createdDate'] }),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
    ]);

    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });

    let jobs = allJobs.map(j => {
      const cid = Array.isArray(j.customer) ? j.customer[0] : j.customer;
      return { id: j.id, jobId: j.jobId, customerName: custMap[cid ?? ''] ?? '', service: j.service ?? '', jobDate: j.jobDate ?? '', createdDate: j.createdDate ?? '' };
    }).sort((a, b) => defaultSort(a, b, 'jobId'));

    if (input.search) {
      const q = input.search.toLowerCase();
      jobs = jobs.filter(j =>
        j.customerName.toLowerCase().includes(q) ||
        j.service.toLowerCase().includes(q) ||
        String(j.jobId).toLowerCase().includes(q)
      );
    }

    return { jobs: jobs.slice(0, 50) };
  },
});
