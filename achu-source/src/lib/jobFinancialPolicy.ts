/**
 * FIX 2 — ACHU-008: Single source of truth for job financial treatment.
 * Used by Dashboard, Jobs list, Customer Portal, and any revenue/outstanding reporting.
 *
 * DO NOT hardcode different exclusion lists in separate files.
 * Import this helper everywhere financial treatment of a job status is needed.
 */

export type JobFinancialTreatment = {
  /** Whether this job contributes to revenue totals */
  includesRevenue: boolean;
  /** Whether this job contributes to amount due / outstanding balance */
  includesAmountDue: boolean;
  /** Whether this job is included in customer financial totals */
  includesCustomerTotals: boolean;
};

/**
 * Returns the financial treatment for a given job status and amount charged.
 *
 * Policy:
 * - Enquiry: excluded from everything
 * - Booked / Confirmed / In Progress: included in amount due + outstanding + customer totals (not revenue)
 * - Completed: included in everything (revenue + amount due + outstanding + customer totals)
 * - Cancelled / No Access: included ONLY when amountCharged > 0
 */
export function getJobFinancialTreatment(
  status: string | undefined,
  amountCharged: number | undefined,
): JobFinancialTreatment {
  const charged = amountCharged ?? 0;

  switch (status) {
    case 'Enquiry':
      return { includesRevenue: false, includesAmountDue: false, includesCustomerTotals: false };

    case 'Booked':
    case 'Confirmed':
    case 'In Progress':
      return { includesRevenue: false, includesAmountDue: true, includesCustomerTotals: true };

    case 'Completed':
      return { includesRevenue: true, includesAmountDue: true, includesCustomerTotals: true };

    case 'Cancelled':
    case 'No Access':
      if (charged > 0) {
        return { includesRevenue: true, includesAmountDue: true, includesCustomerTotals: true };
      }
      return { includesRevenue: false, includesAmountDue: false, includesCustomerTotals: false };

    default:
      // Unknown future statuses: include if charged > 0
      return charged > 0
        ? { includesRevenue: false, includesAmountDue: true, includesCustomerTotals: true }
        : { includesRevenue: false, includesAmountDue: false, includesCustomerTotals: false };
  }
}

/**
 * Helper: does this job contribute to outstanding balance calculations?
 * Shortcut used by dashboard / jobs list / customer portal.
 */
export function jobIncludedInOutstanding(status: string | undefined, amountCharged: number | undefined): boolean {
  return getJobFinancialTreatment(status, amountCharged).includesAmountDue;
}

/**
 * Helper: does this job contribute to revenue calculations?
 */
export function jobIncludedInRevenue(status: string | undefined, amountCharged: number | undefined): boolean {
  return getJobFinancialTreatment(status, amountCharged).includesRevenue;
}

/**
 * ACHU-054: Money To Collect — is this job's outstanding balance operationally due for collection NOW?
 *
 * Rule:
 * - Completed with outstanding > 0: YES (Collect Payment / Part Payment Outstanding)
 * - In Progress with outstanding > 0: YES (payment collection during job is part of workflow)
 * - Booked/Confirmed whose scheduled start has passed: YES (amount is treated as currently due)
 * - Booked/Confirmed future (start not yet passed): NO — not yet due
 * - Enquiry: NEVER
 * - Cancelled/No Access with charged > 0: YES — follows existing financial policy
 * - Fully paid: NO
 *
 * @param status Job status
 * @param amountCharged Amount charged
 * @param outstandingBalance Pre-calculated outstanding balance (must be > 0 to be collectible)
 * @param jobDate YYYY-MM-DD
 * @param startTime HH:MM or undefined
 * @param todayStr YYYY-MM-DD in Europe/London
 * @param nowTime HH:MM in Europe/London
 */
export function isCollectibleNow(params: {
  status: string | undefined;
  amountCharged: number | undefined;
  outstandingBalance: number;
  jobDate: string | undefined;
  startTime: string | undefined;
  todayStr: string;
  nowTime: string;
}): { collectible: boolean; suggestedAction: string } {
  const { status, amountCharged, outstandingBalance, jobDate, startTime, todayStr, nowTime } = params;

  if (outstandingBalance <= 0) return { collectible: false, suggestedAction: '' };

  // Enquiry never collectible
  if (status === 'Enquiry') return { collectible: false, suggestedAction: '' };

  // Must pass general financial policy
  if (!jobIncludedInOutstanding(status, amountCharged)) return { collectible: false, suggestedAction: '' };

  const charged = amountCharged ?? 0;
  const received = charged - outstandingBalance;
  const hasPart = received > 0;

  // Completed — always collectible
  if (status === 'Completed') {
    return {
      collectible: true,
      suggestedAction: hasPart ? `Part Payment Outstanding — collect £${outstandingBalance.toFixed(2)}` : `Collect Payment — £${outstandingBalance.toFixed(2)}`,
    };
  }

  // In Progress — collectible (payment during job)
  if (status === 'In Progress') {
    return {
      collectible: true,
      suggestedAction: hasPart ? `Part Payment Outstanding — collect £${outstandingBalance.toFixed(2)}` : `Collect Payment — £${outstandingBalance.toFixed(2)}`,
    };
  }

  // Cancelled with charge — review
  if (status === 'Cancelled') {
    return {
      collectible: true,
      suggestedAction: `Review Cancelled Charge — £${outstandingBalance.toFixed(2)}`,
    };
  }

  // No Access with charge — review
  if (status === 'No Access') {
    return {
      collectible: true,
      suggestedAction: `Review No Access Charge — £${outstandingBalance.toFixed(2)}`,
    };
  }

  // Booked / Confirmed — only if scheduled start has passed
  if (status === 'Booked' || status === 'Confirmed') {
    const jDate = jobDate ?? '';
    if (!jDate) return { collectible: false, suggestedAction: '' };

    let startPassed = false;
    if (jDate < todayStr) {
      startPassed = true; // Past date — start has passed
    } else if (jDate === todayStr) {
      if (startTime) {
        startPassed = startTime <= nowTime;
      } else {
        startPassed = true; // No start time on today's job — treat as due
      }
    }
    // Future jobs: startPassed stays false

    if (startPassed) {
      return {
        collectible: true,
        suggestedAction: hasPart ? `Part Payment Outstanding — collect £${outstandingBalance.toFixed(2)}` : `Collect Payment — £${outstandingBalance.toFixed(2)}`,
      };
    }
    return { collectible: false, suggestedAction: '' };
  }

  // Unknown status with outstanding — include if financial policy says so
  return {
    collectible: true,
    suggestedAction: `Collect Payment — £${outstandingBalance.toFixed(2)}`,
  };
}

