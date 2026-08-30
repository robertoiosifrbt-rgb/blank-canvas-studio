/**
 * ACHU-086: Central allow-lists for expense and payment categorical fields.
 * Backend validation, database expectations and frontend options must all agree.
 * Import these constants everywhere instead of declaring local arrays.
 */

// ─── Expense enums ─────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'Cleaning Supplies', 'Equipment', 'Fuel', 'Parking', 'Vehicle',
  'Insurance', 'Marketing', 'Printing', 'Uniform', 'Software',
  'Phone', 'Bank Fees', 'Professional Fees', 'Staff Payment', 'Refund', 'Other',
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const EXPENSE_PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Other'] as const;
export type ExpensePaymentMethod = typeof EXPENSE_PAYMENT_METHODS[number];

export const EXPENSE_DOCUMENT_TYPES = ['Receipt', 'Invoice', 'Credit Note', 'Other'] as const;
export type ExpenseDocumentType = typeof EXPENSE_DOCUMENT_TYPES[number];

export const EXPENSE_CURRENCIES = ['GBP', 'EUR', 'USD'] as const;
export type ExpenseCurrency = typeof EXPENSE_CURRENCIES[number];

export const EXPENSE_EXTRACTION_STATUSES = [
  'Pending', 'Processing', 'Review Required', 'Confirmed', 'Failed',
] as const;
export type ExpenseExtractionStatus = typeof EXPENSE_EXTRACTION_STATUSES[number];

export const EXPENSE_DUPLICATE_CHECK_STATUSES = [
  'Clear', 'Possible Duplicate', 'Confirmed Unique', 'Reviewed — Saved Anyway',
] as const;
export type ExpenseDuplicateCheckStatus = typeof EXPENSE_DUPLICATE_CHECK_STATUSES[number];

export const VOID_STATUSES = ['Active', 'Voided'] as const;

// ─── Payment enums ─────────────────────────────────────────────────

export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Payment Link', 'Other'] as const;
export const PAYMENT_PROVIDERS = ['Square', 'Bank', 'Cash', 'Halifax', 'Other'] as const;
export const PAYMENT_STATUSES = ['Pending', 'Received', 'Failed', 'Refunded', 'Cancelled'] as const;

