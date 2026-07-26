import { z } from 'zod';
import { createEndpoint, Jobs, Payments, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { isActiveRecord } from '../lib/voidFilter';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { jobIncludedInOutstanding, getJobFinancialTreatment } from '../lib/jobFinancialPolicy';
import { ukToday } from '../lib/ukDate';
import { extractId, validateOffset, PaginationValidationError } from '../lib/validation';
import { customerPortalJobSchema, customerPortalPaymentSchema, customerPortalCustomerSchema } from '../lib/zodSchemas';
import { toPence, fromPence } from '../lib/money';

// Statuses that appear in Upcoming ONLY if date is today or future
const FUTURE_UPCOMING_STATUSES = ['Enquiry', 'Booked', 'Confirmed'];
const ALWAYS_UPCOMING_STATUS = 'In Progress';
const HISTORY_STATUSES = ['Completed', 'Cancelled', 'No Access'];

const SAFE_CUSTOMER_FIELDS = ['id', 'customerName', 'email', 'phone', 'address', 'postcode', 'customerType', 'status'];
const SAFE_JOB_FIELDS = ['id', 'jobId', 'jobDate', 'service', 'address', 'startTime', 'finishTime', 'status', 'amountCharged', 'customerInstructions'];
const SAFE_PAYMENT_FIELDS = ['id', 'paymentId', 'paymentDate', 'amount', 'paymentMethod', 'paymentProvider', 'paymentStatus', 'externalReference', 'voidStatus', 'job'];

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    jobHistoryOffset: z.number().optional(),
    paymentOffset: z.number().optional(),
  }),
  outputSchema: z.object({
    customer: customerPortalCustomerSchema.nullable(),
    upcomingJobs: z.array(customerPortalJobSchema),
    pastJobs: z.array(customerPortalJobSchema),
    pastJobsHasMore: z.boolean(),
    payments: z.array(customerPortalPaymentSchema),
    paymentsHasMore: z.boolean(),
    financialSummary: z.object({
      totalJobValue: z.number(),
      totalPaymentsReceived: z.number(),
      totalRefunds: z.number(),
      netAmountPaid: z.number(),
      outstandingBalance: z.number(),
    }),
    error: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Customer') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied. This area is for customers only.' });
    }
    if (!context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your account is currently inactive. Please contact ACHU.' });
    }

    const customerId = extractId(context.user.customer);
    if (!customerId) {
      return {
        customer: null, upcomingJobs: [], pastJobs: [], pastJobsHasMore: false,
        payments: [], paymentsHasMore: false,
        financialSummary: { totalJobValue: 0, totalPaymentsReceived: 0, totalRefunds: 0, netAmountPaid: 0, outstandingBalance: 0 },
      };
    }

    const customerRaw = await Customers.findOne({ id: customerId, fields: SAFE_CUSTOMER_FIELDS });
    if (!customerRaw) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Customer record not found. Please contact ACHU.' });
    }
    if (customerRaw.status === 'Blocked' || customerRaw.status === 'Inactive') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your account is currently inactive. Please contact ACHU.' });
    }

    const customer = {
      customerName: customerRaw.customerName,
      email: customerRaw.email,
      phone: customerRaw.phone,
      address: customerRaw.address,
      postcode: customerRaw.postcode,
      customerType: customerRaw.customerType,
      status: customerRaw.status,
    };

    let allJobs: any[];
    let allPayments: any[];
    try {
      [allJobs, allPayments] = await Promise.all([
        fetchAll((p) => Jobs.findAll(p), { filters: { customer: customerId }, fields: SAFE_JOB_FIELDS, strict: true }),
        fetchAll((p) => Payments.findAll(p), { filters: { customer: customerId }, fields: SAFE_PAYMENT_FIELDS, strict: true }),
      ]);
    } catch (e: any) {
      throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Unable to load complete financial data. Please try again.' });
    }

    const today = ukToday();

    const allUpcoming = allJobs
      .filter(j => {
        const status = j.status ?? '';
        if (status === ALWAYS_UPCOMING_STATUS) return true;
        if (FUTURE_UPCOMING_STATUSES.includes(status) && j.jobDate && j.jobDate >= today) return true;
        return false;
      })
      .sort((a, b) => (a.jobDate ?? '').localeCompare(b.jobDate ?? '') || defaultSort(a, b, 'jobId'));

    const pastJobs = allJobs
      .filter(j => {
        const status = j.status ?? '';
        if (HISTORY_STATUSES.includes(status)) return true;
        if (FUTURE_UPCOMING_STATUSES.includes(status) && j.jobDate && j.jobDate < today) return true;
        return false;
      })
      .sort((a, b) => (b.jobDate ?? '').localeCompare(a.jobDate ?? '') || defaultSort(a, b, 'jobId'));

    let historyOffset: number;
    try {
      historyOffset = validateOffset(input.jobHistoryOffset, 'jobHistoryOffset');
    } catch (e) {
      if (e instanceof PaginationValidationError) throw new ZiteError({ code: 'BAD_REQUEST', message: e.message });
      throw e;
    }
    const HISTORY_PAGE = 20;
    const pagedHistory = pastJobs.slice(historyOffset, historyOffset + HISTORY_PAGE);
    const pastJobsHasMore = historyOffset + HISTORY_PAGE < pastJobs.length;

    const activePayments = allPayments.filter(p => isActiveRecord(p.voidStatus));

    // ACHU-123 + ACHU-126: Build per-job payment map in integer pence, respecting financial policy
    const jobPaymentMapPence = new Map<string, { paidPence: number; refundedPence: number }>();
    for (const p of activePayments) {
      const jobId = extractId(p.job);
      if (!jobId) continue;
      const entry = jobPaymentMapPence.get(jobId) || { paidPence: 0, refundedPence: 0 };
      if (p.paymentStatus === 'Received') entry.paidPence += toPence(p.amount ?? 0);
      if (p.paymentStatus === 'Refunded') entry.refundedPence += toPence(p.amount ?? 0);
      jobPaymentMapPence.set(jobId, entry);
    }

    // Per-job financial calculation using integer pence
    let totalJobValuePence = 0;
    let totalPaymentsReceivedPence = 0;
    let totalRefundsPence = 0;
    let outstandingBalancePence = 0;
    for (const j of allJobs) {
      if (!getJobFinancialTreatment(j.status, j.amountCharged).includesCustomerTotals) continue;
      const chargedPence = toPence(j.amountCharged ?? 0);
      const pm = jobPaymentMapPence.get(j.id) || { paidPence: 0, refundedPence: 0 };
      // ACHU-126: Only count payments for financially included jobs
      const treatment = getJobFinancialTreatment(j.status, j.amountCharged);
      if (treatment.includesCustomerTotals) {
        totalJobValuePence += chargedPence;
        totalPaymentsReceivedPence += pm.paidPence;
        totalRefundsPence += pm.refundedPence;
        const netForJobPence = pm.paidPence - pm.refundedPence;
        outstandingBalancePence += Math.max(0, chargedPence - netForJobPence);
      }
    }
    const netAmountPaidPence = totalPaymentsReceivedPence - totalRefundsPence;

    const enrichJob = (j: any) => {
      const pm = jobPaymentMapPence.get(j.id) || { paidPence: 0, refundedPence: 0 };
      const amountPaidPence = pm.paidPence - pm.refundedPence;
      const chargedPence = toPence(j.amountCharged ?? 0);
      const included = jobIncludedInOutstanding(j.status, j.amountCharged);
      const outstandingPence = included ? Math.max(0, chargedPence - amountPaidPence) : 0;
      let paymentStatus = 'Unpaid';
      const charged = j.amountCharged ?? 0;
      if (!included || charged === 0) paymentStatus = '—';
      else if (amountPaidPence >= chargedPence && chargedPence > 0) paymentStatus = 'Paid';
      else if (amountPaidPence > 0) paymentStatus = 'Partial';
      return {
        jobId: j.jobId, jobDate: j.jobDate, service: j.service, address: j.address,
        startTime: j.startTime, finishTime: j.finishTime, status: j.status,
        amountCharged: charged, amountPaid: fromPence(amountPaidPence), outstandingBalance: fromPence(outstandingPence),
        paymentStatus, customerInstructions: j.customerInstructions,
      };
    };

    let paymentOffset: number;
    try {
      paymentOffset = validateOffset(input.paymentOffset, 'paymentOffset');
    } catch (e) {
      if (e instanceof PaginationValidationError) throw new ZiteError({ code: 'BAD_REQUEST', message: e.message });
      throw e;
    }
    const PAYMENT_PAGE = 20;
    const sortedPayments = activePayments
      .sort((a, b) => (b.paymentDate ?? '').localeCompare(a.paymentDate ?? '') || defaultSort(a, b, 'paymentId'));
    const pagedPayments = sortedPayments.slice(paymentOffset, paymentOffset + PAYMENT_PAGE);
    const paymentsHasMore = paymentOffset + PAYMENT_PAGE < sortedPayments.length;

    const paymentJobMap = new Map<string, string>();
    for (const j of allJobs) {
      if (j.jobId) paymentJobMap.set(j.id, j.jobId);
    }

    const safePayments = pagedPayments.map(p => {
      const jobRef = extractId(p.job);
      return {
        _key: p.paymentId ?? p.id,
        paymentDate: p.paymentDate,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentProvider: p.paymentProvider,
        paymentStatus: p.paymentStatus,
        externalReference: p.externalReference,
        linkedJobId: jobRef ? paymentJobMap.get(jobRef) : undefined,
      };
    });

    return {
      customer,
      upcomingJobs: allUpcoming.map(enrichJob),
      pastJobs: pagedHistory.map(enrichJob),
      pastJobsHasMore,
      payments: safePayments,
      paymentsHasMore,
      financialSummary: {
        totalJobValue: fromPence(totalJobValuePence),
        totalPaymentsReceived: fromPence(totalPaymentsReceivedPence),
        totalRefunds: fromPence(totalRefundsPence),
        netAmountPaid: fromPence(netAmountPaidPence),
        outstandingBalance: fromPence(outstandingBalancePence),
      },
    };
  },
});
