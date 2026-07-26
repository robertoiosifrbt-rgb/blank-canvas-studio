import { z } from 'zod';
import { createEndpoint, Customers, Jobs, Payments, Expenses, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll, searchAll } from '../lib/fetchAll';
import { customerRecordSchema, jobRecordSchema, paymentRecordSchema, expenseRecordSchema } from '../lib/zodSchemas';
import { extractId, LIMITS } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ query: z.string().min(1).max(LIMITS.globalSearch) }),
  outputSchema: z.object({
    customers: z.array(customerRecordSchema),
    jobs: z.array(jobRecordSchema),
    payments: z.array(paymentRecordSchema),
    expenses: z.array(expenseRecordSchema),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    const q = input.query.toLowerCase();

    const [allCusts, allJobsForMap] = await Promise.all([
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
      fetchAll((p) => Jobs.findAll(p), { fields: ['id', 'jobId', 'service', 'customer'] }),
    ]);

    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });

    const jobMap: Record<string, { jobId: any; service: string; customerName: string }> = {};
    allJobsForMap.forEach(j => {
      const cid = extractId(j.customer);
      jobMap[j.id] = { jobId: j.jobId, service: j.service ?? '', customerName: custMap[cid ?? ''] ?? '' };
    });

    const [customers, jobs, payments, expenses] = await Promise.all([
      searchAll(
        (p) => Customers.findAll(p),
        (r: any) => (r.customerName ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q) || (r.phone ?? '').toLowerCase().includes(q) || (r.address ?? '').toLowerCase().includes(q),
        8,
      ),
      searchAll(
        (p) => Jobs.findAll(p),
        (r: any) => {
          const cid = extractId(r.customer);
          const cName = custMap[cid ?? ''] ?? '';
          return (r.service ?? '').toLowerCase().includes(q) || (r.address ?? '').toLowerCase().includes(q) || String(r.jobId).toLowerCase().includes(q) || cName.toLowerCase().includes(q) || (r.quoteNumber ?? '').toLowerCase().includes(q);
        },
        8,
      ),
      searchAll(
        (p) => Payments.findAll(p),
        (r: any) => {
          const jid = extractId(r.job);
          const jInfo = jobMap[jid ?? ''];
          const cid = extractId(r.customer);
          const cName = custMap[cid ?? ''] ?? '';
          return (r.externalReference ?? '').toLowerCase().includes(q) ||
            String(r.paymentId).toLowerCase().includes(q) ||
            cName.toLowerCase().includes(q) ||
            (jInfo && (String(jInfo.jobId).toLowerCase().includes(q) || jInfo.service.toLowerCase().includes(q)));
        },
        8,
      ),
      searchAll(
        (p) => Expenses.findAll(p),
        (r: any) => (r.supplier ?? '').toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q),
        8,
      ),
    ]);

    const enrichedJobs = jobs.map((j: any) => {
      const cid = extractId(j.customer);
      return { ...j, customerName: custMap[cid ?? ''] ?? '' };
    });
    const enrichedPayments = payments.map((p: any) => {
      const cid = extractId(p.customer);
      const jid = extractId(p.job);
      const jInfo = jobMap[jid ?? ''];
      return { ...p, customerName: custMap[cid ?? ''] ?? '', jobLabel: jInfo ? `#${jInfo.jobId} - ${jInfo.service}` : '' };
    });

    return { customers, jobs: enrichedJobs, payments: enrichedPayments, expenses };
  },
});
