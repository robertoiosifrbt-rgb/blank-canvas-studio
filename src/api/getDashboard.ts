import { z } from 'zod';
import { createEndpoint, Payments, Expenses, Jobs, FinancialSettings, ZiteError } from 'zite-integrations-backend-sdk';
import { isActiveRecord } from '../lib/voidFilter';
import { fetchAll } from '../lib/fetchAll';
import { ukToday, weekBounds, monthStart, quarterStart, quarterEnd } from '../lib/ukDate';
import { validateDateRange } from '../lib/validation';
import { jobIncludedInOutstanding, jobIncludedInRevenue, getJobFinancialTreatment } from '../lib/jobFinancialPolicy';
import { isOperationalJobToday, isUpcomingOperationalJob } from '../lib/jobOperationalPolicy';
import { SETTINGS_KEY, resolveTaxYearRange } from '../lib/financialSettingsHelper';
import { dashboardRecentExpenseSchema } from '../lib/zodSchemas';
import { toPence, fromPence, percentOfPence, sumPence } from '../lib/money';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    period: z.enum(['week', 'month', 'quarter', 'taxYear', 'allTime', 'custom']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  outputSchema: z.object({
    totalIncome: z.number(), totalExpenses: z.number(), netProfit: z.number(),
    taxReserve: z.number(), niReserve: z.number(), emergencyReserve: z.number(),
    availableCash: z.number(), outstandingBalances: z.number(),
    jobsToday: z.number(), upcomingJobs: z.number(), completedJobs: z.number(), cancelledJobs: z.number(),
    periodExpenses: z.number(), recentExpenses: z.array(dashboardRecentExpenseSchema),
    expensesByCategory: z.array(z.object({ category: z.string(), total: z.number() })),
    settingsConfigured: z.boolean(), taxRate: z.number(), niRate: z.number(), emergencyRate: z.number(),
    periodLabel: z.string(),
    excludedPaymentCount: z.number().optional(),
    excludedPaymentAmount: z.number().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ACHU-034: Retrieve canonical settings by settingsKey, fall back to active
    let fsRes = await FinancialSettings.findOne({ filters: { settingsKey: SETTINGS_KEY } });
    if (!fsRes) fsRes = await FinancialSettings.findOne({ filters: { active: true } });

    const settingsConfigured = !!fsRes;
    // ACHU-124: Inactive settings must not silently apply reserve percentages
    const settingsActive = settingsConfigured && fsRes!.active !== false;
    const taxRate = settingsActive ? (fsRes!.taxReserve ?? 0) : 0;
    const niRate = settingsActive ? (fsRes!.nationalInsuranceReserve ?? 0) : 0;
    const emergencyRate = settingsActive ? (fsRes!.emergencyReserve ?? 0) : 0;

    const todayStr = ukToday();
    let startDate = '';
    let endDate = todayStr;
    let periodLabel = 'This Month';
    const period = input.period ?? 'month';

    if (period === 'week') {
      const wb = weekBounds(todayStr);
      startDate = wb.start; endDate = wb.end; periodLabel = 'This Week';
    } else if (period === 'month') {
      startDate = monthStart(todayStr); periodLabel = 'This Month';
    } else if (period === 'quarter') {
      startDate = quarterStart(todayStr); endDate = quarterEnd(todayStr); periodLabel = 'This Quarter';
    } else if (period === 'taxYear') {
      const resolved = resolveTaxYearRange(fsRes, todayStr);
      startDate = resolved.start; endDate = resolved.end; periodLabel = 'This Tax Year';
    } else if (period === 'custom') {
      // ACHU-078: Backend-authoritative custom period validation
      const dateErr = validateDateRange(input.startDate, input.endDate);
      if (dateErr) throw new ZiteError({ code: 'BAD_REQUEST', message: dateErr });
      startDate = input.startDate!; endDate = input.endDate!; periodLabel = 'Custom Period';
    } else { startDate = ''; endDate = ''; periodLabel = 'All Time'; }

    let allPayments: any[], allExpenses: any[], allJobs: any[];
    try {
      [allPayments, allExpenses, allJobs] = await Promise.all([
        fetchAll((p) => Payments.findAll(p), { strict: true }),
        fetchAll((p) => Expenses.findAll(p), { strict: true }),
        fetchAll((p) => Jobs.findAll(p), { strict: true }),
      ]);
    } catch (e: any) {
      throw new ZiteError({ code: 'INTERNAL_ERROR', message: 'Unable to load complete financial data. Please try again.' });
    }

    const inPeriod = (date?: string) => {
      if (!date) return false;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    const activePayments = allPayments.filter(p => isActiveRecord(p.voidStatus));
    const activeExpenses = allExpenses.filter(e => isActiveRecord(e.voidStatus));

    // ACHU-126: Build job lookup and determine financial eligibility per job
    const jobMap = new Map<string, any>();
    for (const j of allJobs) { jobMap.set(j.id, j); }

    const isPaymentFinanciallyIncluded = (p: any): boolean => {
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      if (!jid) return false; // orphan payment — not counted as normal revenue
      const job = jobMap.get(jid);
      if (!job) return false; // deleted job — not counted
      const treatment = getJobFinancialTreatment(job.status, job.amountCharged);
      return treatment.includesAmountDue;
    };

    // Separate included vs excluded payments
    const includedActivePayments = activePayments.filter(isPaymentFinanciallyIncluded);
    const excludedActivePayments = activePayments.filter(p => !isPaymentFinanciallyIncluded(p));

    // Period-filtered payments (only financially included)
    const pp = includedActivePayments.filter(p => inPeriod(p.paymentDate));
    const pe = activeExpenses.filter(e => inPeriod(e.expenseDate));

    // ACHU-123: All aggregation in integer pence
    const receivedPence = sumPence(
      pp.filter(p => p.paymentStatus === 'Received'),
      p => p.amount,
    );
    const refundedPence = sumPence(
      pp.filter(p => p.paymentStatus === 'Refunded'),
      p => p.amount,
    );
    const totalIncomePence = receivedPence - refundedPence;
    const totalExpensesPence = sumPence(pe, e => e.amount);
    const netProfitPence = totalIncomePence - totalExpensesPence;

    const positiveProfitPence = Math.max(0, netProfitPence);
    const taxReservePence = settingsConfigured ? percentOfPence(positiveProfitPence, taxRate) : 0;
    const niReservePence = settingsConfigured ? percentOfPence(positiveProfitPence, niRate) : 0;
    const emergencyReservePence = settingsConfigured ? percentOfPence(positiveProfitPence, emergencyRate) : 0;
    const availableCashPence = netProfitPence - taxReservePence - niReservePence - emergencyReservePence;

    // Outstanding balances — uses ALL active included payments (not period-filtered)
    const jobPaidPence: Record<string, number> = {};
    const jobRefundedPence: Record<string, number> = {};
    includedActivePayments.filter(p => p.paymentStatus === 'Received').forEach(p => {
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      if (jid) jobPaidPence[jid] = (jobPaidPence[jid] || 0) + toPence(p.amount ?? 0);
    });
    includedActivePayments.filter(p => p.paymentStatus === 'Refunded').forEach(p => {
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      if (jid) jobRefundedPence[jid] = (jobRefundedPence[jid] || 0) + toPence(p.amount ?? 0);
    });
    const outstandingPence = allJobs
      .filter(j => jobIncludedInOutstanding(j.status, j.amountCharged))
      .reduce((s, j) => {
        const netReceivedPence = (jobPaidPence[j.id] ?? 0) - (jobRefundedPence[j.id] ?? 0);
        return s + Math.max(0, toPence(j.amountCharged ?? 0) - netReceivedPence);
      }, 0);

    // ACHU-041: Jobs Today uses OPERATIONAL policy, not financial
    const jobsToday = allJobs.filter(j => isOperationalJobToday(j.status, j.jobDate ?? '', todayStr)).length;
    const upcomingJobs = allJobs.filter(j => isUpcomingOperationalJob(j.status, j.jobDate, todayStr)).length;
    const pj = allJobs.filter(j => inPeriod(j.jobDate));
    const completedJobs = pj.filter(j => j.status === 'Completed').length;
    const cancelledJobs = pj.filter(j => j.status === 'Cancelled').length;

    const recentExpenses = pe.sort((a, b) => (b.expenseDate ?? '').localeCompare(a.expenseDate ?? '')).slice(0, 5);

    // ACHU-123: Expense category totals in pence
    const catMapPence: Record<string, number> = {};
    pe.forEach(e => {
      const cat = e.category ?? 'Other';
      catMapPence[cat] = (catMapPence[cat] || 0) + toPence(e.amount ?? 0);
    });
    const expensesByCategory = Object.entries(catMapPence)
      .map(([category, pence]) => ({ category, total: fromPence(pence) }))
      .sort((a, b) => b.total - a.total);

    // ACHU-126: Excluded payment diagnostics
    const excludedReceivedRefunded = excludedActivePayments.filter(
      p => p.paymentStatus === 'Received' || p.paymentStatus === 'Refunded'
    );
    const excludedPaymentCount = excludedReceivedRefunded.length;
    const excludedPaymentAmountPence = sumPence(excludedReceivedRefunded, p => p.amount);

    return {
      totalIncome: fromPence(totalIncomePence),
      totalExpenses: fromPence(totalExpensesPence),
      netProfit: fromPence(netProfitPence),
      taxReserve: fromPence(taxReservePence),
      niReserve: fromPence(niReservePence),
      emergencyReserve: fromPence(emergencyReservePence),
      availableCash: fromPence(availableCashPence),
      outstandingBalances: fromPence(outstandingPence),
      jobsToday, upcomingJobs, completedJobs, cancelledJobs,
      periodExpenses: fromPence(totalExpensesPence),
      recentExpenses, expensesByCategory,
      settingsConfigured, taxRate, niRate, emergencyRate, periodLabel,
      ...(excludedPaymentCount > 0 ? {
        excludedPaymentCount,
        excludedPaymentAmount: fromPence(excludedPaymentAmountPence),
      } : {}),
    };
  },
});
