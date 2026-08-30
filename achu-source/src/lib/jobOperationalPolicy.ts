/**
 * ACHU-041 — Separate Operational Job Policy
 * 
 * These helpers govern operational job visibility (Dashboard counts, portals).
 * DO NOT reuse financial inclusion rules (jobFinancialPolicy.ts) for operational counts.
 */

/** Statuses included in "Jobs Today" count */
const JOBS_TODAY_INCLUDED: ReadonlySet<string> = new Set([
  'Booked', 'Confirmed', 'In Progress', 'Completed',
]);

/** Statuses included in "Upcoming Jobs" count */
const UPCOMING_INCLUDED: ReadonlySet<string> = new Set([
  'Booked', 'Confirmed',
]);

/** Statuses that are definitively closed / historical */
const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  'Completed', 'Cancelled', 'No Access',
]);

/**
 * Is this job counted in "Jobs Today"?
 * Includes Booked, Confirmed, In Progress, Completed.
 * Excludes Enquiry, Cancelled, No Access.
 */
export function isOperationalJobToday(status: string | undefined, jobDate: string, todayStr: string): boolean {
  if (jobDate !== todayStr) return false;
  return JOBS_TODAY_INCLUDED.has(status ?? '');
}

/**
 * Is this job counted in "Upcoming Jobs"?
 * Includes future Booked, Confirmed only.
 * Excludes Enquiry, Completed, Cancelled, No Access.
 */
export function isUpcomingOperationalJob(status: string | undefined, jobDate: string | undefined, todayStr: string): boolean {
  if (!jobDate || jobDate <= todayStr) return false;
  return UPCOMING_INCLUDED.has(status ?? '');
}

/**
 * Is this job historical / closed?
 */
export function isClosedStatus(status: string | undefined): boolean {
  return CLOSED_STATUSES.has(status ?? '');
}

export { CLOSED_STATUSES, JOBS_TODAY_INCLUDED, UPCOMING_INCLUDED };

