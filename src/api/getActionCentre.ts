import { z } from 'zod';
import { createEndpoint, Jobs, Payments, Expenses, JobAssignments, Customers, Cleaners, UserAccounts, QuoteRequests, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { isActiveRecord } from '../lib/voidFilter';
import { isConversionEligible } from '../lib/quoteRequestEligibility';
import { isCollectibleNow, getJobFinancialTreatment } from '../lib/jobFinancialPolicy';
import { isClosedStatus } from '../lib/jobOperationalPolicy';
import { isDuplicateUnresolved } from '../lib/duplicateReviewPolicy';
import { ukToday, ukTimeNow, addDays, weekBounds } from '../lib/ukDate';
import { toPence, fromPence, sumPence } from '../lib/money';


// ─── Schemas ───────────────────────────────────────────────────────

const completedJobSchema = z.object({
  id: z.string(),
  jobId: z.any(),
  customerName: z.string(),
  service: z.string().nullable(),
  address: z.string().nullable(),
  jobDate: z.string(),
  actualFinishTime: z.string().nullable(),
  amountCharged: z.number().nullable(),
  paymentStatus: z.string().nullable(),
  assignedCleanerNames: z.array(z.string()),
});

const futureJobSchema = z.object({
  id: z.string(),
  jobId: z.any(),
  customerName: z.string(),
  jobDate: z.string(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  service: z.string().nullable(),
  status: z.string().nullable(),
  address: z.string().nullable(),
  amountCharged: z.number().nullable(),
  paymentStatus: z.string().nullable(),
  assignedCleanerCount: z.number(),
  assignedCleanerNames: z.array(z.string()),
  unassigned: z.boolean(),
  missingStartTime: z.boolean(),
});

const actionItemSchema = z.object({
  id: z.string(),
  entityType: z.enum(['job', 'payment', 'expense', 'userAccount', 'quoteRequest']),
  entityId: z.string(),
  reason: z.string(),
  reasonCode: z.string(),
  label: z.string(),
  customerName: z.string().optional(),
  date: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  amountCharged: z.number().optional().nullable(),
  amountReceived: z.number().optional().nullable(),
  outstandingBalance: z.number().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  linkedJobLabel: z.string().optional().nullable(),
  voidStatus: z.string().optional().nullable(),
  suggestedAction: z.string().optional(),
  extra: z.record(z.string()).optional(),
});

const sectionSummarySchema = z.object({
  totalCount: z.number(),
  totalAmount: z.number().optional(),
  categories: z.array(z.object({
    key: z.string(),
    label: z.string(),
    count: z.number(),
    amount: z.number().optional(),
  })),
  items: z.array(actionItemSchema),
});

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    jobs: sectionSummarySchema,
    money: sectionSummarySchema,
    refunds: sectionSummarySchema,
    cancelled: sectionSummarySchema,
    preparedAccounts: sectionSummarySchema,
    expenses: sectionSummarySchema,
    conversions: sectionSummarySchema,
    futureJobs: z.object({
      items: z.array(futureJobSchema),
      activeCount: z.number(),
      totalCount: z.number(),
      tomorrowStr: z.string(),
      weekEndStr: z.string(),
    }),
    completedJobs: z.object({
      items: z.array(completedJobSchema),
      totalCount: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const todayStr = ukToday();
    const nowTime = ukTimeNow(); // HH:MM in Europe/London

    const [allJobs, allPayments, allExpenses, allAssignments, allCustomers, allCleaners, allUserAccounts, allQuoteRequests] = await Promise.all([
      fetchAll((p) => Jobs.findAll(p), { strict: true }),
      fetchAll((p) => Payments.findAll(p), { strict: true }),
      fetchAll((p) => Expenses.findAll(p), { strict: true }),
      fetchAll((p) => JobAssignments.findAll(p)),
      fetchAll((p) => Customers.findAll(p)),
      fetchAll((p) => Cleaners.findAll(p)),
      fetchAll((p) => UserAccounts.findAll(p)),
      fetchAll((p) => QuoteRequests.findAll(p)),
    ]);

    // Build lookups
    const custMap: Record<string, string> = {};
    allCustomers.forEach(c => { custMap[c.id] = c.customerName ?? `Customer #${c.customerId}`; });
    const cleanerMap: Record<string, string> = {};
    allCleaners.forEach(c => { cleanerMap[c.id] = c.cleanerName ?? `Cleaner #${c.cleanerId}`; });

    const getCustomerName = (custField?: string | string[]) => {
      const cid = Array.isArray(custField) ? custField[0] : custField;
      return cid ? (custMap[cid] ?? 'Unknown') : 'No Customer';
    };

    // ACHU-097: Build cleaner active status map
    const cleanerActiveMap: Record<string, boolean> = {};
    allCleaners.forEach(c => { cleanerActiveMap[c.id] = c.active ?? false; });

    // ACHU-097: Assignments by job — with integrity classification
    const assignmentsByJob: Record<string, any[]> = {};
    const validAssignmentsByJob: Record<string, any[]> = {}; // only valid (existing + active cleaner) assignments
    allAssignments.forEach(a => {
      const jid = Array.isArray(a.job) ? a.job[0] : a.job;
      if (jid) { (assignmentsByJob[jid] ??= []).push(a); }
    });

    // Classify each assignment
    type AssignmentIssue = { assignmentId: string; jobId: string; reasonCode: string; reason: string };
    const assignmentIssues: AssignmentIssue[] = [];

    for (const [jid, assigns] of Object.entries(assignmentsByJob)) {
      for (const a of assigns) {
        const cleanerId = Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner;
        if (!cleanerId) {
          assignmentIssues.push({ assignmentId: a.id, jobId: jid, reasonCode: 'missing-cleaner-link', reason: 'Assignment has no cleaner linked' });
          continue;
        }
        if (!(cleanerId in cleanerActiveMap)) {
          assignmentIssues.push({ assignmentId: a.id, jobId: jid, reasonCode: 'deleted-cleaner', reason: 'Cleaner record does not exist' });
          continue;
        }
        if (!cleanerActiveMap[cleanerId]) {
          assignmentIssues.push({ assignmentId: a.id, jobId: jid, reasonCode: 'inactive-cleaner', reason: `Cleaner "${cleanerMap[cleanerId] ?? 'Unknown'}" is inactive` });
          continue;
        }
        // Valid assignment
        (validAssignmentsByJob[jid] ??= []).push(a);
      }
    }

    // ACHU-123 + ACHU-126: Payment totals per job in integer pence, respecting financial policy
    const activePayments = allPayments.filter(p => isActiveRecord(p.voidStatus));
    const jobPaidPence: Record<string, number> = {};
    const jobRefundedPence: Record<string, number> = {};

    // Build job lookup for financial policy
    const jobLookup = new Map<string, any>();
    allJobs.forEach(j => jobLookup.set(j.id, j));

    activePayments.filter(p => p.paymentStatus === 'Received').forEach(p => {
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      if (!jid) return;
      // ACHU-126: Only count payments for financially included jobs
      const job = jobLookup.get(jid);
      if (!job || !getJobFinancialTreatment(job.status, job.amountCharged).includesAmountDue) return;
      jobPaidPence[jid] = (jobPaidPence[jid] || 0) + toPence(p.amount ?? 0);
    });
    activePayments.filter(p => p.paymentStatus === 'Refunded').forEach(p => {
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      if (!jid) return;
      const job = jobLookup.get(jid);
      if (!job || !getJobFinancialTreatment(job.status, job.amountCharged).includesAmountDue) return;
      jobRefundedPence[jid] = (jobRefundedPence[jid] || 0) + toPence(p.amount ?? 0);
    });

    const getJobNetReceivedPence = (jobId: string) => (jobPaidPence[jobId] ?? 0) - (jobRefundedPence[jobId] ?? 0);
    const getJobNetReceived = (jobId: string) => fromPence(getJobNetReceivedPence(jobId));
    const getJobOutstanding = (j: any) => {
      const netPence = getJobNetReceivedPence(j.id);
      return fromPence(Math.max(0, toPence(j.amountCharged ?? 0) - netPence));
    };
    const getJobPaymentStatus = (j: any) => {
      const chargedPence = toPence(j.amountCharged ?? 0);
      const netPence = getJobNetReceivedPence(j.id);
      if (chargedPence <= 0) return 'N/A';
      if (netPence <= 0) return 'Unpaid';
      if (netPence < chargedPence) return 'Partial';
      return 'Paid';
    };

    // Job label
    const jobLabel = (j: any) => `Job #${j.jobId}${j.service ? ` – ${j.service}` : ''}`;
    const jobLabelById: Record<string, string> = {};
    allJobs.forEach(j => { jobLabelById[j.id] = jobLabel(j); });

    // ─── SECTION 1: Jobs To Do ──────────────────────────────────────
    type Item = z.infer<typeof actionItemSchema>;
    const jobItems: Item[] = [];

    const NON_ACTIONABLE = new Set(['Completed', 'Cancelled', 'No Access']);

    for (const j of allJobs) {
      const s = j.status ?? '';
      const jDate = j.jobDate ?? '';

      // Not Started — only Booked/Confirmed, after scheduled start has passed in Europe/London
      if ((s === 'Booked' || s === 'Confirmed') && !j.actualStartTime) {
        let isNotStarted = false;
        if (jDate < todayStr) {
          // Past date — always not started
          isNotStarted = true;
        } else if (jDate === todayStr) {
          if (j.startTime) {
            // Has scheduled start — only after that time has passed
            // startTime is HH:MM format, nowTime is HH:MM
            isNotStarted = j.startTime <= nowTime;
          } else {
            // No scheduled start — treat as not started on the scheduled date
            isNotStarted = true;
          }
        }
        // Future jobs (jDate > todayStr) are never Not Started
        if (isNotStarted) {
          const timeInfo = j.startTime ? ` (start ${j.startTime})` : '';
          jobItems.push({
            id: `job-notstarted-${j.id}`, entityType: 'job', entityId: j.id,
            reason: `${s} job due ${jDate === todayStr ? 'today' : jDate}${timeInfo} — not started`,
            reasonCode: 'not-started', label: jobLabel(j), customerName: getCustomerName(j.customer),
            date: jDate, status: s, service: j.service, suggestedAction: 'Start job',
            amountCharged: j.amountCharged,
          });
        }
      }

      // Enquiries — separate category, never under Not Started
      if (s === 'Enquiry') {
        const hasCharged = (j.amountCharged ?? 0) > 0;
        const suggestedAction = hasCharged ? 'Awaiting customer response' : 'Quote required';
        jobItems.push({
          id: `job-enquiry-${j.id}`, entityType: 'job', entityId: j.id,
          reason: 'Enquiry — needs review or quote',
          reasonCode: 'enquiry', label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: jDate || undefined, status: s, service: j.service,
          suggestedAction, amountCharged: j.amountCharged,
        });
      }

      // In Progress
      if (s === 'In Progress') {
        jobItems.push({
          id: `job-inprogress-${j.id}`, entityType: 'job', entityId: j.id,
          reason: 'Job currently in progress', reasonCode: 'in-progress',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: jDate, status: s, service: j.service, suggestedAction: 'Monitor / complete',
          amountCharged: j.amountCharged,
        });
      }

      // Overdue
      if (jDate && jDate < todayStr && !NON_ACTIONABLE.has(s) && s !== 'Enquiry') {
        // Avoid double-counting with not-started — overdue is specifically for past-due non-completed
        if (!((s === 'Booked' || s === 'Confirmed') && !j.actualStartTime)) {
          jobItems.push({
            id: `job-overdue-${j.id}`, entityType: 'job', entityId: j.id,
            reason: `Overdue — job was scheduled for ${jDate}`, reasonCode: 'overdue',
            label: jobLabel(j), customerName: getCustomerName(j.customer),
            date: jDate, status: s, service: j.service, suggestedAction: 'Update status',
            amountCharged: j.amountCharged,
          });
        }
      }

      // ACHU-097: Unassigned — must have no VALID assignments (not just no rows)
      if ((s === 'Booked' || s === 'Confirmed') && !(validAssignmentsByJob[j.id]?.length)) {
        const hasInvalidAssignments = (assignmentsByJob[j.id]?.length ?? 0) > 0;
        jobItems.push({
          id: `job-unassigned-${j.id}`, entityType: 'job', entityId: j.id,
          reason: hasInvalidAssignments ? 'No active/valid cleaner assigned (broken assignments exist)' : 'No cleaner assigned',
          reasonCode: 'unassigned',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: jDate, status: s, service: j.service, suggestedAction: 'Assign cleaner',
          amountCharged: j.amountCharged,
        });
      }

      // Completed with missing details
      if (s === 'Completed' && !j.actualFinishTime) {
        jobItems.push({
          id: `job-missingdetails-${j.id}`, entityType: 'job', entityId: j.id,
          reason: 'Completed but missing actual finish time', reasonCode: 'missing-details',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: jDate, status: s, service: j.service, suggestedAction: 'Add finish time',
          amountCharged: j.amountCharged,
        });
      }
    }

    const jobCats = [
      { key: 'not-started', label: 'Not Started' },
      { key: 'in-progress', label: 'In Progress' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'unassigned', label: 'Unassigned' },
      { key: 'missing-details', label: 'Missing Details' },
      { key: 'enquiry', label: 'Enquiries' },
    ].map(c => ({ ...c, count: jobItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ─── SECTION 2: Money To Collect (ACHU-054) ────────────────────
    const moneyItems: Item[] = [];

    for (const j of allJobs) {
      const outstanding = getJobOutstanding(j);
      const result = isCollectibleNow({
        status: j.status,
        amountCharged: j.amountCharged,
        outstandingBalance: outstanding,
        jobDate: j.jobDate,
        startTime: j.startTime,
        todayStr,
        nowTime,
      });
      if (!result.collectible) continue;

      const pStatus = getJobPaymentStatus(j);
      const netRec = getJobNetReceived(j.id);
      const reasonCode = pStatus === 'Unpaid' ? 'unpaid' : 'partial';
      const isOverdue = (j.jobDate ?? '') < todayStr;

      moneyItems.push({
        id: `money-${reasonCode}-${j.id}`, entityType: 'job', entityId: j.id,
        reason: pStatus === 'Unpaid' ? 'No payment received' : `Partial payment — £${netRec.toFixed(2)} of £${(j.amountCharged ?? 0).toFixed(2)}`,
        reasonCode: isOverdue ? `${reasonCode}-overdue` : reasonCode,
        label: jobLabel(j), customerName: getCustomerName(j.customer),
        date: j.jobDate, status: j.status, service: j.service,
        amountCharged: j.amountCharged, amountReceived: netRec,
        outstandingBalance: outstanding, paymentStatus: pStatus,
        suggestedAction: result.suggestedAction,
      });
    }

    // ACHU-123: Aggregate category totals in pence
    const unpaidItems = moneyItems.filter(i => i.reasonCode === 'unpaid' || i.reasonCode === 'unpaid-overdue');
    const partialItems = moneyItems.filter(i => i.reasonCode === 'partial' || i.reasonCode === 'partial-overdue');
    const overdueItems = moneyItems.filter(i => i.reasonCode.endsWith('-overdue'));

    const sumOutstandingPence = (items: Item[]) => sumPence(items, i => i.outstandingBalance);
    const totalOutstandingAmt = fromPence(sumOutstandingPence(moneyItems));

    const moneyCats = [
      { key: 'unpaid', label: 'Unpaid Jobs', count: unpaidItems.length, amount: fromPence(sumOutstandingPence(unpaidItems)) },
      { key: 'partial', label: 'Partial Payments', count: partialItems.length, amount: fromPence(sumOutstandingPence(partialItems)) },
      { key: 'total', label: 'Total Outstanding', count: moneyItems.length, amount: totalOutstandingAmt },
      { key: 'overdue', label: 'Overdue Outstanding', count: overdueItems.length, amount: fromPence(sumOutstandingPence(overdueItems)) },
    ].filter(c => c.count > 0);

    // ─── SECTION 3: Refunds and Corrections ─────────────────────────
    const refundItems: Item[] = [];

    for (const j of allJobs) {
      const netPence = getJobNetReceivedPence(j.id);
      const chargedPence = toPence(j.amountCharged ?? 0);
      const net = fromPence(netPence);
      // Cancelled with money
      if (j.status === 'Cancelled' && netPence > 0) {
        refundItems.push({
          id: `refund-cancelled-${j.id}`, entityType: 'job', entityId: j.id,
          reason: `Cancelled job has £${net.toFixed(2)} received`, reasonCode: 'cancelled-paid',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: j.jobDate, status: j.status, amount: net, paymentStatus: 'Refund Review',
          suggestedAction: 'Review cancellation payment',
        });
      }
      // No Access with money
      if (j.status === 'No Access' && netPence > 0) {
        refundItems.push({
          id: `refund-noaccess-${j.id}`, entityType: 'job', entityId: j.id,
          reason: `No Access job has £${net.toFixed(2)} received`, reasonCode: 'noaccess-paid',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: j.jobDate, status: j.status, amount: net, paymentStatus: 'Refund Review',
          suggestedAction: 'Review payment',
        });
      }
      // Overpayment — compare and subtract in integer pence
      if (netPence > chargedPence && chargedPence > 0) {
        const overpaidPence = netPence - chargedPence;
        const overpaid = fromPence(overpaidPence);
        refundItems.push({
          id: `refund-overpaid-${j.id}`, entityType: 'job', entityId: j.id,
          reason: `Overpaid by £${overpaid.toFixed(2)} (received £${net.toFixed(2)}, charged £${fromPence(chargedPence).toFixed(2)})`,
          reasonCode: 'overpayment', label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: j.jobDate, status: j.status, amount: overpaid, paymentStatus: 'Overpaid',
          suggestedAction: 'Review overpayment',
        });
      }
    }

    // Voided payments
    const voidedPayments = allPayments.filter(p => p.voidStatus === 'Voided');
    for (const p of voidedPayments) {
      refundItems.push({
        id: `refund-voided-${p.id}`, entityType: 'payment', entityId: p.id,
        reason: 'Payment has been voided', reasonCode: 'voided-payment',
        label: `Payment #${p.paymentId}`, customerName: getCustomerName(p.customer),
        date: p.paymentDate, status: p.paymentStatus, amount: p.amount,
        voidStatus: 'Voided', suggestedAction: 'Review voided payment',
      });
    }

    // Payments needing review
    // ACHU-098: Only unresolved duplicate statuses are actionable.
    // "Reviewed — Saved Anyway" means admin already reviewed — not actionable.
    for (const p of allPayments) {
      if (p.voidStatus === 'Voided') continue;
      const reasons: string[] = [];
      if (isDuplicateUnresolved(p.duplicateCheckStatus)) reasons.push('Possible duplicate');
      if (p.paymentStatus === 'Failed') reasons.push('Failed payment');
      if (p.paymentStatus === 'Pending') reasons.push('Pending payment');
      const jid = Array.isArray(p.job) ? p.job[0] : p.job;
      const cid = Array.isArray(p.customer) ? p.customer[0] : p.customer;
      if (!jid) reasons.push('Missing linked job');
      if (!cid) reasons.push('Missing linked customer');
      if (reasons.length > 0) {
        refundItems.push({
          id: `refund-review-${p.id}`, entityType: 'payment', entityId: p.id,
          reason: reasons.join('; '), reasonCode: 'payment-review',
          label: `Payment #${p.paymentId}`, customerName: getCustomerName(p.customer),
          date: p.paymentDate, status: p.paymentStatus, amount: p.amount,
          suggestedAction: 'Inspect payment',
        });
      }
    }

    const refundCats = [
      { key: 'cancelled-paid', label: 'Cancelled with Payment' },
      { key: 'noaccess-paid', label: 'No Access with Payment' },
      { key: 'overpayment', label: 'Possible Overpayment' },
      { key: 'voided-payment', label: 'Voided Payments' },
      { key: 'payment-review', label: 'Payments Needing Review' },
    ].map(c => ({ ...c, count: refundItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ─── SECTION 4: Cancelled and Exceptions ────────────────────────
    const cancelledItems: Item[] = [];
    // ACHU-100: Prepared accounts are informational — separate from actionable exceptions
    const preparedAccountItems: Item[] = [];

    for (const j of allJobs) {
      if (j.status === 'Cancelled') {
        cancelledItems.push({
          id: `exc-cancelled-${j.id}`, entityType: 'job', entityId: j.id,
          reason: 'Cancelled job', reasonCode: 'cancelled',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: j.jobDate, status: j.status, suggestedAction: 'Review',
        });
      }
      if (j.status === 'No Access') {
        cancelledItems.push({
          id: `exc-noaccess-${j.id}`, entityType: 'job', entityId: j.id,
          reason: 'No access on arrival', reasonCode: 'no-access',
          label: jobLabel(j), customerName: getCustomerName(j.customer),
          date: j.jobDate, status: j.status, suggestedAction: 'Review',
        });
      }
    }

    // Duplicate / inconsistent user accounts
    const emailCount: Record<string, string[]> = {};
    allUserAccounts.forEach(u => {
      const em = (u.email ?? '').trim().toLowerCase();
      if (em) (emailCount[em] ??= []).push(u.id);
    });
    for (const [em, ids] of Object.entries(emailCount)) {
      if (ids.length > 1) {
        for (const uid of ids) {
          cancelledItems.push({
            id: `exc-dupemail-${uid}`, entityType: 'userAccount', entityId: uid,
            reason: `Duplicate email address (${ids.length} accounts share this email)`,
            reasonCode: 'duplicate-email',
            label: `User Account`, customerName: undefined,
            suggestedAction: 'Inspect security issue',
          });
        }
      }
    }

    // ACHU-100: UserAccount role/link classification
    // Distinguish between:
    //   - Active account missing required profile → data-error
    //   - Inactive account with no profile (intentional preparation) → prepared-account (informational)
    //   - Inactive account with contradictory links → data-error
    for (const u of allUserAccounts) {
      const cid = Array.isArray(u.customer) ? u.customer[0] : u.customer;
      const clid = Array.isArray(u.cleaner) ? u.cleaner[0] : u.cleaner;
      const isActive = u.active ?? false;
      const label = `User Account #${u.userAccountId}`;

      // Cross-link validation (contradictory data — always data-error regardless of active state)
      if (u.role === 'Customer' && clid && !cid) {
        cancelledItems.push({
          id: `exc-crosslink-${u.id}`, entityType: 'userAccount', entityId: u.id,
          reason: 'Customer role incorrectly linked to a Cleaner record',
          reasonCode: 'data-error', label,
          suggestedAction: 'Fix role or link',
        });
        continue;
      }
      if (u.role === 'Cleaner' && cid && !clid) {
        cancelledItems.push({
          id: `exc-crosslink-${u.id}`, entityType: 'userAccount', entityId: u.id,
          reason: 'Cleaner role incorrectly linked to a Customer record',
          reasonCode: 'data-error', label,
          suggestedAction: 'Fix role or link',
        });
        continue;
      }

      // Missing profile link
      if (u.role === 'Customer' && !cid) {
        if (isActive) {
          // Active account MUST have a profile — data error
          cancelledItems.push({
            id: `exc-missinglink-${u.id}`, entityType: 'userAccount', entityId: u.id,
            reason: 'Active Customer account with no linked customer record',
            reasonCode: 'data-error', label,
            suggestedAction: 'Link customer record',
          });
        } else {
          // Inactive account without profile — prepared for later activation (informational only)
          preparedAccountItems.push({
            id: `exc-prepared-${u.id}`, entityType: 'userAccount', entityId: u.id,
            reason: 'Inactive Customer account prepared for later activation',
            reasonCode: 'prepared-account', label,
            suggestedAction: 'Link & activate when ready',
          });
        }
      }
      if (u.role === 'Cleaner' && !clid) {
        if (isActive) {
          cancelledItems.push({
            id: `exc-missinglink-${u.id}`, entityType: 'userAccount', entityId: u.id,
            reason: 'Active Cleaner account with no linked cleaner record',
            reasonCode: 'data-error', label,
            suggestedAction: 'Link cleaner record',
          });
        } else {
          preparedAccountItems.push({
            id: `exc-prepared-${u.id}`, entityType: 'userAccount', entityId: u.id,
            reason: 'Inactive Cleaner account prepared for later activation',
            reasonCode: 'prepared-account', label,
            suggestedAction: 'Link & activate when ready',
          });
        }
      }
    }

    // ACHU-097: Assignment integrity issues
    for (const issue of assignmentIssues) {
      const j = jobLookup.get(issue.jobId);
      cancelledItems.push({
        id: `exc-assignment-${issue.assignmentId}`, entityType: 'job', entityId: issue.jobId,
        reason: issue.reason, reasonCode: `assignment-${issue.reasonCode}`,
        label: j ? jobLabel(j) : `Job ${issue.jobId.slice(0, 8)}`,
        customerName: j ? getCustomerName(j.customer) : undefined,
        date: j?.jobDate, status: j?.status,
        suggestedAction: 'Fix or remove assignment',
        extra: { assignmentId: issue.assignmentId },
      });
    }

    // Payments with duplicate flag
    for (const p of allPayments) {
      if (p.duplicateCheckStatus === 'Possible Duplicate' && p.voidStatus !== 'Voided') {
        cancelledItems.push({
          id: `exc-dupepay-${p.id}`, entityType: 'payment', entityId: p.id,
          reason: 'Flagged as possible duplicate payment', reasonCode: 'duplicate-record',
          label: `Payment #${p.paymentId}`, amount: p.amount,
          date: p.paymentDate, suggestedAction: 'Inspect duplicate warning',
        });
      }
    }

    const cancelledCats = [
      { key: 'cancelled', label: 'Cancelled Jobs' },
      { key: 'no-access', label: 'No Access Jobs' },
      { key: 'duplicate-email', label: 'Duplicate Emails' },
      { key: 'duplicate-record', label: 'Duplicate Records' },
      { key: 'data-error', label: 'Data Errors' },
      { key: 'assignment-missing-cleaner-link', label: 'Missing Cleaner Links' },
      { key: 'assignment-deleted-cleaner', label: 'Deleted Cleaner Refs' },
      { key: 'assignment-inactive-cleaner', label: 'Inactive Cleaner Assignments' },
    ].map(c => ({ ...c, count: cancelledItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ACHU-100: Prepared Accounts — informational, separate from actionable exceptions
    const preparedCats = [
      { key: 'prepared-account', label: 'Prepared Accounts' },
    ].map(c => ({ ...c, count: preparedAccountItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ─── SECTION 5: Expenses and Receipts ───────────────────────────
    const expenseItems: Item[] = [];
    const activeExpenses = allExpenses.filter(e => isActiveRecord(e.voidStatus));

    for (const e of activeExpenses) {
      const hasFile = e.receiptFile && e.receiptFile.length > 0 && e.receiptFile[0]?.url;
      const ljid = Array.isArray(e.linkedJob) ? e.linkedJob[0] : e.linkedJob;

      // Receipt missing (receiptAvailable marked but no file)
      if (e.receiptAvailable && !hasFile) {
        expenseItems.push({
          id: `exp-receiptmissing-${e.id}`, entityType: 'expense', entityId: e.id,
          reason: 'Receipt marked as available but file is missing', reasonCode: 'receipt-missing',
          label: `Expense #${e.expenseId}`, date: e.expenseDate, supplier: e.supplier,
          category: e.category, amount: e.amount,
          linkedJobLabel: ljid ? (jobLabelById[ljid] ?? ljid) : undefined,
          suggestedAction: 'Upload receipt',
        });
      }

      // Receipt not reviewed
      if (hasFile && !e.manuallyReviewed) {
        expenseItems.push({
          id: `exp-notreviewed-${e.id}`, entityType: 'expense', entityId: e.id,
          reason: 'Receipt uploaded but not yet reviewed', reasonCode: 'receipt-review',
          label: `Expense #${e.expenseId}`, date: e.expenseDate, supplier: e.supplier,
          category: e.category, amount: e.amount,
          linkedJobLabel: ljid ? (jobLabelById[ljid] ?? ljid) : undefined,
          suggestedAction: 'Review receipt',
        });
      }

      // Extraction needs review
      if (e.extractionStatus && ['Failed', 'Review Required'].includes(e.extractionStatus)) {
        expenseItems.push({
          id: `exp-extraction-${e.id}`, entityType: 'expense', entityId: e.id,
          reason: `Extraction ${e.extractionStatus.toLowerCase()}`, reasonCode: 'extraction-review',
          label: `Expense #${e.expenseId}`, date: e.expenseDate, supplier: e.supplier,
          category: e.category, amount: e.amount,
          linkedJobLabel: ljid ? (jobLabelById[ljid] ?? ljid) : undefined,
          suggestedAction: 'Review extraction',
        });
      }

      // Possible duplicate
      if (e.duplicateCheckStatus === 'Possible Duplicate') {
        expenseItems.push({
          id: `exp-duplicate-${e.id}`, entityType: 'expense', entityId: e.id,
          reason: 'Flagged as possible duplicate', reasonCode: 'duplicate-expense',
          label: `Expense #${e.expenseId}`, date: e.expenseDate, supplier: e.supplier,
          category: e.category, amount: e.amount,
          linkedJobLabel: ljid ? (jobLabelById[ljid] ?? ljid) : undefined,
          suggestedAction: 'Inspect duplicate',
        });
      }
    }

    // Voided expenses
    const voidedExpenses = allExpenses.filter(e => e.voidStatus === 'Voided');
    for (const e of voidedExpenses) {
      const ljid = Array.isArray(e.linkedJob) ? e.linkedJob[0] : e.linkedJob;
      expenseItems.push({
        id: `exp-voided-${e.id}`, entityType: 'expense', entityId: e.id,
        reason: 'Expense has been voided', reasonCode: 'voided-expense',
        label: `Expense #${e.expenseId}`, date: e.expenseDate, supplier: e.supplier,
        category: e.category, amount: e.amount, voidStatus: 'Voided',
        linkedJobLabel: ljid ? (jobLabelById[ljid] ?? ljid) : undefined,
        suggestedAction: 'Review voided expense',
      });
    }

    const expenseCats = [
      { key: 'receipt-missing', label: 'Receipt Missing' },
      { key: 'receipt-review', label: 'Receipt Not Reviewed' },
      { key: 'extraction-review', label: 'Extraction Needs Review' },
      { key: 'duplicate-expense', label: 'Possible Duplicate' },
      { key: 'voided-expense', label: 'Voided Expenses' },
    ].map(c => ({ ...c, count: expenseItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ─── SECTION 6: Future Jobs ───────────────────────────────────────
    const tomorrowStr = addDays(todayStr, 1);
    const weekEnd = weekBounds(todayStr).end;

    const futureJobItems = allJobs
      .filter(j => (j.jobDate ?? '') > todayStr)
      .map(j => {
        // ACHU-097: Use only valid assignments for future job display
        const assigns = validAssignmentsByJob[j.id] ?? [];
        const cleanerNames = assigns.map(a => {
          const cid = Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner;
          return cid ? (cleanerMap[cid] ?? 'Unknown') : 'Unknown';
        });
        return {
          id: j.id,
          jobId: j.jobId,
          customerName: getCustomerName(j.customer),
          jobDate: j.jobDate ?? '',
          startTime: j.startTime ?? null,
          finishTime: j.finishTime ?? null,
          service: j.service ?? null,
          status: j.status ?? null,
          address: j.address ?? null,
          amountCharged: j.amountCharged ?? null,
          paymentStatus: getJobPaymentStatus(j),
          assignedCleanerCount: assigns.length,
          assignedCleanerNames: cleanerNames,
          unassigned: assigns.length === 0,
          missingStartTime: !j.startTime,
        };
      })
      .sort((a, b) => {
        const dc = a.jobDate.localeCompare(b.jobDate);
        if (dc !== 0) return dc;
        // Nulls sort after timed
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime && !b.startTime) return -1;
        if (!a.startTime && b.startTime) return 1;
        return String(a.jobId).localeCompare(String(b.jobId));
      });

    // ACHU-099: Use shared closed-status policy (Completed, Cancelled, No Access)
    const activeCount = futureJobItems.filter(j => !isClosedStatus(j.status ?? undefined)).length;

    // ─── SECTION 7: Quote Request Conversions (ACHU-094) ────────────
    const conversionItems: Item[] = [];

    for (const qr of allQuoteRequests) {
      const qrDisplayId = qr.quoteRequestId != null ? `#${qr.quoteRequestId}` : qr.id.slice(0, 8);
      const qrLabel = `Quote Request ${qrDisplayId}`;

      if (qr.status === 'Conversion Error') {
        conversionItems.push({
          id: `conv-error-${qr.id}`, entityType: 'quoteRequest', entityId: qr.id,
          reason: qr.conversionError || 'Conversion failed — see details',
          reasonCode: 'conversion-error',
          label: qrLabel, customerName: qr.fullName || qr.email || undefined,
          date: qr.submittedAt ?? undefined, status: 'Conversion Error',
          suggestedAction: 'Review & retry',
          extra: { email: qr.email || '' },
        });
      }

      if (qr.status === 'Processing' && qr.conversionToken) {
        // Stuck in processing — interrupted conversion
        conversionItems.push({
          id: `conv-stuck-${qr.id}`, entityType: 'quoteRequest', entityId: qr.id,
          reason: 'Conversion interrupted — stuck in Processing',
          reasonCode: 'conversion-stuck',
          label: qrLabel, customerName: qr.fullName || qr.email || undefined,
          date: qr.submittedAt ?? undefined, status: 'Processing',
          suggestedAction: 'Retry conversion',
        });
      }

      if (isConversionEligible(qr.status) && !((Array.isArray(qr.job) ? qr.job[0] : qr.job))) {
        conversionItems.push({
          id: `conv-pending-${qr.id}`, entityType: 'quoteRequest', entityId: qr.id,
          reason: `${qr.status} — awaiting conversion`,
          reasonCode: 'conversion-pending',
          label: qrLabel, customerName: qr.fullName || qr.email || undefined,
          date: qr.submittedAt ?? undefined, status: qr.status ?? undefined,
          suggestedAction: 'Run conversion',
        });
      }

      if (qr.status === 'Converted') {
        conversionItems.push({
          id: `conv-success-${qr.id}`, entityType: 'quoteRequest', entityId: qr.id,
          reason: 'Successfully converted',
          reasonCode: 'conversion-success',
          label: qrLabel, customerName: qr.fullName || qr.email || undefined,
          date: qr.submittedAt ?? undefined, status: 'Converted',
          suggestedAction: 'View records',
        });
      }
    }

    const conversionCats = [
      { key: 'conversion-error', label: 'Failed Conversions' },
      { key: 'conversion-stuck', label: 'Stuck / Interrupted' },
      { key: 'conversion-pending', label: 'Pending Conversion' },
      { key: 'conversion-success', label: 'Successfully Converted' },
    ].map(c => ({ ...c, count: conversionItems.filter(i => i.reasonCode === c.key).length })).filter(c => c.count > 0);

    // ─── SECTION 8: Completed Jobs (ACHU-135) ─────────────────────────
    const completedJobItems = allJobs
      .filter(j => j.status === 'Completed')
      .map(j => {
        const assigns = validAssignmentsByJob[j.id] ?? [];
        const cleanerNames = assigns.map(a => {
          const cid = Array.isArray(a.cleaner) ? a.cleaner[0] : a.cleaner;
          return cid ? (cleanerMap[cid] ?? 'Unknown') : 'Unknown';
        });
        return {
          id: j.id,
          jobId: j.jobId,
          customerName: getCustomerName(j.customer),
          service: j.service ?? null,
          address: j.address ?? null,
          jobDate: j.jobDate ?? '',
          actualFinishTime: j.actualFinishTime ?? null,
          amountCharged: j.amountCharged ?? null,
          paymentStatus: getJobPaymentStatus(j),
          assignedCleanerNames: cleanerNames,
        };
      })
      .sort((a, b) => b.jobDate.localeCompare(a.jobDate));

    return {
      jobs: { totalCount: jobItems.length, categories: jobCats, items: jobItems },
      money: { totalCount: moneyItems.length, totalAmount: totalOutstandingAmt, categories: moneyCats, items: moneyItems },
      refunds: { totalCount: refundItems.length, categories: refundCats, items: refundItems },
      cancelled: { totalCount: cancelledItems.length, categories: cancelledCats, items: cancelledItems },
      preparedAccounts: { totalCount: preparedAccountItems.length, categories: preparedCats, items: preparedAccountItems },
      expenses: { totalCount: expenseItems.length, categories: expenseCats, items: expenseItems },
      conversions: { totalCount: conversionItems.length, categories: conversionCats, items: conversionItems },
      futureJobs: {
        items: futureJobItems,
        activeCount,
        totalCount: futureJobItems.length,
        tomorrowStr,
        weekEndStr: weekEnd,
      },
      completedJobs: {
        items: completedJobItems,
        totalCount: completedJobItems.length,
      },
    };
  },
});
