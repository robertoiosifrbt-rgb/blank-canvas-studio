/**
 * ACHU-039 — Reusable Zod output schemas for all record types.
 * Replaces z.any() in high-risk endpoint output schemas.
 */
import { z } from 'zod';

// ─── Shared field schemas ──────────────────────────────────────────

/** Linked record field: string ID, array of IDs, null, or undefined */
const linkedRecordField = z.union([
  z.string(),
  z.array(z.string()),
  z.null(),
]).optional();

/** Autonumber primary key — number (typical) or string (edge cases), or null */
const autoId = z.union([z.number(), z.string(), z.null()]).optional();

// ─── Customer ──────────────────────────────────────────────────────

export const customerRecordSchema = z.object({
  id: z.string(),
  customerId: autoId,
  customerName: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  customerType: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdDate: z.string().optional().nullable(),
  payments: linkedRecordField,
  jobs: linkedRecordField,
  userAccounts: linkedRecordField,
}).passthrough();

// ─── Payment ───────────────────────────────────────────────────────

export const paymentRecordSchema = z.object({
  id: z.string(),
  paymentId: autoId,
  job: linkedRecordField,
  customer: linkedRecordField,
  paymentDate: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentProvider: z.string().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  voidStatus: z.string().optional().nullable(),
  correctionNotes: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  idempotencyToken: z.string().optional().nullable(),
  duplicateCheckStatus: z.string().optional().nullable(),
  duplicateOverrideBy: z.string().optional().nullable(),
  duplicateOverrideAt: z.string().optional().nullable(),
  duplicateMatchedPaymentIDs: z.string().optional().nullable(),
  // Enriched calculated fields
  customerName: z.string().optional(),
  jobLabel: z.string().optional(),
}).passthrough();

// ─── Job ───────────────────────────────────────────────────────────

export const jobRecordSchema = z.object({
  id: z.string(),
  jobId: autoId,
  customer: linkedRecordField,
  jobDate: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  finishTime: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  amountCharged: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdDate: z.string().optional().nullable(),
  customerInstructions: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  cleanerCompletionNotes: z.string().optional().nullable(),
  payments: linkedRecordField,
  expenses: linkedRecordField,
  jobAssignments: linkedRecordField,
  idempotencyToken: z.string().optional().nullable(),
  actualStartTime: z.string().optional().nullable(),
  actualFinishTime: z.string().optional().nullable(),
  quoteNumber: z.string().optional().nullable(),
  // Enriched calculated fields
  customerName: z.string().optional(),
  amountReceived: z.number().optional(),
  outstandingBalance: z.number().optional(),
  paymentStatus: z.string().optional(),
}).passthrough();

// ─── Expense ───────────────────────────────────────────────────────

export const expenseRecordSchema = z.object({
  id: z.string(),
  expenseId: autoId,
  expenseDate: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paidBy: z.string().optional().nullable(),
  linkedJob: linkedRecordField,
  receiptAvailable: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdDate: z.string().optional().nullable(),
  voidStatus: z.string().optional().nullable(),
  correctionNotes: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  receiptFile: z.array(z.object({ url: z.string() })).optional().nullable(),
  documentType: z.string().optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  subtotal: z.number().optional().nullable(),
  vatAmount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  extractionStatus: z.string().optional().nullable(),
  extractionConfidence: z.number().optional().nullable(),
  extractionNotes: z.string().optional().nullable(),
  manuallyReviewed: z.boolean().optional().nullable(),
  duplicateCheckStatus: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  duplicateOverrideBy: z.string().optional().nullable(),
  duplicateOverrideAt: z.string().optional().nullable(),
  duplicateMatchedExpenseIDs: z.string().optional().nullable(),
  idempotencyToken: z.string().optional().nullable(),
  // Enriched
  linkedJobLabel: z.string().optional(),
}).passthrough();

// ─── Cleaner ───────────────────────────────────────────────────────

export const cleanerRecordSchema = z.object({
  id: z.string(),
  cleanerId: autoId,
  cleanerName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  active: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
  userAccounts: linkedRecordField,
  jobAssignments: linkedRecordField,
}).passthrough();

// ─── UserAccount ───────────────────────────────────────────────────

export const userAccountRecordSchema = z.object({
  id: z.string(),
  userAccountId: autoId,
  email: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  customer: linkedRecordField,
  cleaner: linkedRecordField,
  active: z.boolean().optional().nullable(),
  createdDate: z.string().optional().nullable(),
  // Enriched
  customerName: z.string().optional(),
  cleanerName: z.string().optional(),
  duplicateEmail: z.boolean().optional(),
}).passthrough();

// ─── JobAssignment ─────────────────────────────────────────────────

export const jobAssignmentRecordSchema = z.object({
  id: z.string(),
  jobAssignmentId: autoId,
  job: linkedRecordField,
  cleaner: linkedRecordField,
  assignmentRole: z.string().optional().nullable(),
  assignedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignmentUniqueKey: z.string().optional().nullable(),
  // Enriched
  cleanerName: z.string().optional(),
  cleanerPhone: z.string().optional(),
  cleanerEmail: z.string().optional(),
  cleanerActive: z.boolean().optional(),
}).passthrough();

// ─── FinancialSettings ─────────────────────────────────────────────

export const financialSettingsSchema = z.object({
  id: z.string(),
  financialSettingsId: autoId,
  taxReserve: z.number().optional().nullable(),
  nationalInsuranceReserve: z.number().optional().nullable(),
  emergencyReserve: z.number().optional().nullable(),
  taxYearStart: z.string().optional().nullable(),
  taxYearEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional().nullable(),
  createdDate: z.string().optional().nullable(),
  taxYearMode: z.string().optional().nullable(),
  settingsKey: z.string().optional().nullable(),
}).passthrough();

// ─── Audit Event ───────────────────────────────────────────────────

export const auditEventRecordSchema = z.object({
  id: z.string(),
  auditEventId: autoId,
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  timestamp: z.string().optional().nullable(),
  performedBy: z.string().optional(),
  summary: z.string().optional(),
  previousValues: z.string().optional().nullable(),
  newValues: z.string().optional().nullable(),
  correctionNotes: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
}).passthrough();

// ─── Dashboard recent expense ──────────────────────────────────────

export const dashboardRecentExpenseSchema = z.object({
  id: z.string(),
  expenseId: autoId,
  expenseDate: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
}).passthrough();

// ─── Cleaner Portal Quote Details (operational fields only) ────────

const numField = z.number().optional().nullable();

export const cleanerQuoteDetailsSchema = z.object({
  services: z.array(z.string()).optional().nullable(),
  preferredDate: z.string().optional().nullable(),
  preferredTime: z.string().optional().nullable(),
  propertyDetails: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  totalBedrooms: numField,
  totalBathrooms: numField,
  // Regular Cleaning
  regularCleaningBedrooms: numField,
  regularCleaningBathrooms: numField,
  regularCleaningKitchens: numField,
  regularCleaningLivingRooms: numField,
  regularCleaningHallways: numField,
  // Deep Cleaning
  deepCleaningBedrooms: numField,
  deepCleaningBathrooms: numField,
  deepCleaningKitchens: numField,
  deepCleaningLivingRooms: numField,
  deepCleaningHallways: numField,
  // End of Tenancy
  endOfTenancyBedrooms: numField,
  endOfTenancyBathrooms: numField,
  endOfTenancyKitchens: numField,
  endOfTenancyLivingRooms: numField,
  endOfTenancyHallways: numField,
  // Window Cleaning
  interiorWindows: numField,
  exteriorWindows: numField,
  windowsBothSides: numField,
  // Oven Cleaning
  standardOvens: numField,
  doubleOvens: numField,
  // Fridge Cleaning
  fridges: numField,
  fridgeFreezers: numField,
  // Carpet Cleaning
  carpetedRooms: numField,
  staircases: numField,
  // Upholstery Cleaning
  diningChairs: numField,
  armchairs: numField,
  _2SeatSofas: numField,
  _3SeatSofas: numField,
  cornerSofas: numField,
  // Garden Tidy
  lawns: numField,
  leafClearingAreas: numField,
  weedingAreas: numField,
  hedges: numField,
  paths: numField,
  // Steam Sanitisation
  steamSanitisationBedrooms: numField,
  steamSanitisationBathrooms: numField,
  steamSanitisationKitchens: numField,
  steamSanitisationLivingRooms: numField,
});

// ─── Cleaner Portal Job ────────────────────────────────────────────

export const cleanerJobSchema = z.object({
  id: z.string(),
  jobId: autoId,
  jobDate: z.string().optional(),
  startTime: z.string().optional(),
  finishTime: z.string().optional(),
  service: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
  customerInstructions: z.string().optional(),
  cleanerCompletionNotes: z.string().optional(),
  actualStartTime: z.string().optional(),
  actualFinishTime: z.string().optional(),
  quoteDetails: cleanerQuoteDetailsSchema.nullable().optional(),
});

// ─── Customer Portal schemas ───────────────────────────────────────

export const customerPortalJobSchema = z.object({
  jobId: autoId,
  jobDate: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  finishTime: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  amountCharged: z.number(),
  amountPaid: z.number(),
  outstandingBalance: z.number(),
  paymentStatus: z.string(),
  customerInstructions: z.string().optional().nullable(),
});

export const customerPortalPaymentSchema = z.object({
  _key: autoId,
  paymentDate: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentProvider: z.string().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable(),
  linkedJobId: autoId,
});

export const customerPortalCustomerSchema = z.object({
  customerName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  customerType: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

// ─── Duplicate match schemas ───────────────────────────────────────

export const paymentDuplicateMatchSchema = z.object({
  paymentId: autoId,
  paymentDate: z.string().optional(),
  amount: z.number().optional(),
  customerName: z.string().optional(),
  jobLabel: z.string().optional(),
  paymentStatus: z.string().optional(),
  externalReference: z.string().optional(),
});

export const expenseDuplicateMatchSchema = z.object({
  expenseId: autoId,
  expenseDate: z.string().optional(),
  supplier: z.string().optional(),
  amount: z.number().optional(),
  category: z.string().optional(),
  linkedJobLabel: z.string().optional(),
  documentNumber: z.string().optional(),
});
