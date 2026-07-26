import { z } from 'zod';
import { createEndpoint, Jobs, Payments, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { isActiveRecord } from '../lib/voidFilter';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { jobIncludedInOutstanding, getJobFinancialTreatment } from '../lib/jobFinancialPolicy';
import { jobRecordSchema } from '../lib/zodSchemas';
import { extractId } from '../lib/validation';
import { toPence, fromPence } from '../lib/money';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ search: z.string().optional(), customerId: z.string().optional() }),
  outputSchema: z.object({ records: z.array(jobRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const jobFilters = input.customerId ? { customer: input.customerId } : undefined;
    const [allJobs, allPayments, allCusts] = await Promise.all([
      fetchAll((p) => Jobs.findAll(p), jobFilters ? { filters: jobFilters } : undefined),
      fetchAll((p) => Payments.findAll(p)),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
    ]);

    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });

    const activePayments = allPayments.filter(p => isActiveRecord(p.voidStatus));

    // ACHU-126: Build job map for financial policy checks
    const jobMap = new Map<string, any>();
    allJobs.forEach(j => jobMap.set(j.id, j));

    // ACHU-123 + ACHU-126: Aggregate in integer pence, only for financially included jobs
    const jobPaidPence: Record<string, number> = {};
    const jobRefundedPence: Record<string, number> = {};
    for (const p of activePayments) {
      const jid = extractId(p.job);
      if (!jid) continue;
      // ACHU-126: Only count payments whose job is financially included
      const job = jobMap.get(jid);
      if (!job) continue;
      const treatment = getJobFinancialTreatment(job.status, job.amountCharged);
      if (!treatment.includesAmountDue) continue;

      if (p.paymentStatus === 'Received') {
        jobPaidPence[jid] = (jobPaidPence[jid] || 0) + toPence(p.amount ?? 0);
      }
      if (p.paymentStatus === 'Refunded') {
        jobRefundedPence[jid] = (jobRefundedPence[jid] || 0) + toPence(p.amount ?? 0);
      }
    }

    let records = allJobs.map(j => {
      const custId = extractId(j.customer);
      const netReceivedPence = (jobPaidPence[j.id] ?? 0) - (jobRefundedPence[j.id] ?? 0);
      const chargedPence = toPence(j.amountCharged ?? 0);
      const included = jobIncludedInOutstanding(j.status, j.amountCharged);
      const outstandingPence = included ? Math.max(0, chargedPence - netReceivedPence) : 0;
      const netReceived = fromPence(netReceivedPence);
      const outstanding = fromPence(outstandingPence);
      const charged = j.amountCharged ?? 0;
      const paymentStatus = !included || charged === 0 ? '—' : outstandingPence <= 0 ? 'Paid' : netReceivedPence > 0 ? 'Partial' : 'Unpaid';
      return { ...j, customerName: custMap[custId ?? ''] ?? '', amountReceived: netReceived, outstandingBalance: outstanding, paymentStatus };
    });

    if (input.search) {
      const q = input.search.toLowerCase();
      records = records.filter(r =>
        (r.customerName ?? '').toLowerCase().includes(q) ||
        (r.service ?? '').toLowerCase().includes(q) ||
        (r.address ?? '').toLowerCase().includes(q) ||
        (r.quoteNumber ?? '').toLowerCase().includes(q)
      );
    }

    return { records: records.sort((a, b) => defaultSort(a, b, 'jobId')) };
  },
});
