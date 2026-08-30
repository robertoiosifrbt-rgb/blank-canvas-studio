/**
 * ACHU-091/095 — Quote Request Conversion Eligibility
 *
 * Single source of truth for which Quote Request statuses may be converted.
 * Every conversion entry point must call `isConversionEligible()`.
 *
 * "New" Quote Requests must NEVER convert — conversion is allowed only after
 * an explicit business approval state.
 *
 * ACHU-095: Recoverable statuses allow retry/resume WITHOUT resetting to New.
 */

/** Statuses from which a Quote Request may be converted into a Customer + Job. */
export const CONVERSION_ELIGIBLE_STATUSES = ['Approved', 'Accepted', 'Ready for Conversion'] as const;

export type ConversionEligibleStatus = typeof CONVERSION_ELIGIBLE_STATUSES[number];

/** Statuses that indicate a conversion can be recovered/resumed (ACHU-095). */
export const RECOVERABLE_STATUSES = ['Processing', 'Conversion Error'] as const;

export type RecoverableStatus = typeof RECOVERABLE_STATUSES[number];

/** Check whether a Quote Request status allows fresh conversion. */
export function isConversionEligible(status: string | undefined | null): boolean {
  if (!status) return false;
  return (CONVERSION_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

/** Check whether a Quote Request is in a recoverable state (ACHU-095). */
export function isRecoverable(status: string | undefined | null): boolean {
  if (!status) return false;
  return (RECOVERABLE_STATUSES as readonly string[]).includes(status);
}

/** Human-readable list of allowed statuses (for error messages). */
export const ELIGIBLE_STATUS_LIST = CONVERSION_ELIGIBLE_STATUSES.join(', ');

