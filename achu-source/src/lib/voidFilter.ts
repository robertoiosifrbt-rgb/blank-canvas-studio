/**
 * Shared void status helper — single source of truth.
 * Missing Void Status on legacy records = Active.
 * Void Status Active = included in financial calculations.
 * Void Status Voided = excluded from financial calculations.
 */
export function isActiveRecord(voidStatus?: string): boolean {
  return !voidStatus || voidStatus === 'Active';
}

