import { z } from 'zod';
import { createEndpoint, Expenses, Jobs, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { isValidDate, monetaryRound, isValidMoneyAmount, normalizeSupplier, computeExpenseSignature, LIMITS } from '../lib/validation';
import { logAuditSafe, logAuditBestEffort } from '../lib/audit';
import { expenseDuplicateMatchSchema } from '../lib/zodSchemas';
import {
  EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS, EXPENSE_DOCUMENT_TYPES,
  EXPENSE_CURRENCIES, EXPENSE_EXTRACTION_STATUSES, EXPENSE_DUPLICATE_CHECK_STATUSES,
} from '../lib/expenseEnums';
import { toPence, PENNY_TOLERANCE } from '../lib/money';
import { checkRevision, REVISION_FIELDS } from '../lib/concurrency';

const MATERIAL_FIELDS = ['expenseDate', 'supplier', 'category', 'amount', 'paymentMethod', 'paidBy', 'linkedJob', 'voidStatus'] as const;

type DuplicateMatch = z.infer<typeof expenseDuplicateMatchSchema>;

async function findDuplicates(input: {
  expenseDate: string; supplier: string; amount: number;
  documentNumber?: string; linkedJob?: string; category?: string; excludeId?: string;
}): Promise<DuplicateMatch[]> {
  const normalizedSupplier = normalizeSupplier(input.supplier);
  const roundedAmount = monetaryRound(input.amount);
  const allExpenses = await fetchAll(
    (p) => Expenses.findAll(p),
    { fields: ['id', 'expenseId', 'supplier', 'expenseDate', 'amount', 'documentNumber', 'description', 'voidStatus', 'category', 'linkedJob'] },
  );
  const matches = allExpenses.filter(e => {
    if (e.voidStatus === 'Voided') return false;
    if (input.excludeId && e.id === input.excludeId) return false;
    return e.expenseDate === input.expenseDate && normalizeSupplier(e.supplier ?? '') === normalizedSupplier && monetaryRound(e.amount ?? 0) === roundedAmount;
  });
  let jobLabelMap: Record<string, string> = {};
  const jobIds = matches.map(e => Array.isArray(e.linkedJob) ? e.linkedJob[0] : e.linkedJob).filter(Boolean) as string[];
  if (jobIds.length > 0) {
    const [allJobs, allCusts] = await Promise.all([
      fetchAll((p) => Jobs.findAll(p), { fields: ['id', 'jobId', 'service', 'customer'] }),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
    ]);
    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });
    allJobs.forEach(j => {
      const cid = Array.isArray(j.customer) ? j.customer[0] : j.customer;
      jobLabelMap[j.id] = `#${j.jobId} — ${j.service ?? 'Job'} — ${custMap[cid ?? ''] ?? 'Unknown'}`;
    });
  }
  return matches.slice(0, 5).map(e => {
    const ljid = Array.isArray(e.linkedJob) ? e.linkedJob[0] : e.linkedJob;
    return {
      expenseId: e.expenseId, expenseDate: e.expenseDate, supplier: e.supplier,
      amount: e.amount, category: e.category,
      linkedJobLabel: ljid ? (jobLabelMap[ljid] ?? '') : undefined,
      documentNumber: e.documentNumber,
    };
  });
}

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    id: z.string().optional(),
    expenseDate: z.string().min(1, 'Expense date is required'),
    supplier: z.string().min(1, 'Supplier is required').max(LIMITS.supplierName),
    category: z.string().nullable().optional(),
    description: z.string().max(LIMITS.description).nullable().optional(),
    // ACHU-085: Amount must be > 0
    amount: z.number().gt(0, 'Amount must be greater than zero'),
    paymentMethod: z.string().nullable().optional(),
    paidBy: z.string().nullable().optional(),
    linkedJob: z.string().nullable().optional(),
    receiptAvailable: z.boolean().nullable().optional(),
    notes: z.string().max(LIMITS.notes).nullable().optional(),
    voidStatus: z.string().nullable().optional(),
    correctionNotes: z.string().max(LIMITS.correctionNotes).nullable().optional(),
    receiptFileUrl: z.string().nullable().optional(),
    removeReceipt: z.boolean().nullable().optional(),
    documentType: z.string().nullable().optional(),
    documentNumber: z.string().max(LIMITS.documentNumber).nullable().optional(),
    subtotal: z.number().nullable().optional(),
    vatAmount: z.number().nullable().optional(),
    currency: z.string().max(LIMITS.currency).nullable().optional(),
    extractionStatus: z.string().nullable().optional(),
    extractionConfidence: z.number().nullable().optional(),
    extractionNotes: z.string().nullable().optional(),
    manuallyReviewed: z.boolean().nullable().optional(),
    duplicateCheckStatus: z.string().nullable().optional(),
    duplicateOverrideConfirmed: z.boolean().nullable().optional(),
    idempotencyToken: z.string().nullable().optional(),
    _revision: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    duplicateConflict: z.boolean().optional(),
    duplicates: z.array(expenseDuplicateMatchSchema).optional(),
    auditWarning: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const n = (v: string | null | undefined): string | undefined => (v == null || v === '') ? undefined : v;
    const nb = (v: boolean | null | undefined): boolean | undefined => v == null ? undefined : v;
    const nn = (v: number | null | undefined): number | undefined => v == null ? undefined : v;
    input.category = n(input.category) as any;
    input.description = n(input.description) as any;
    input.paymentMethod = n(input.paymentMethod) as any;
    input.paidBy = n(input.paidBy) as any;
    input.linkedJob = n(input.linkedJob) as any;
    input.notes = n(input.notes) as any;
    input.voidStatus = n(input.voidStatus) as any;
    input.correctionNotes = n(input.correctionNotes) as any;
    input.receiptFileUrl = n(input.receiptFileUrl) as any;
    input.documentType = n(input.documentType) as any;
    input.documentNumber = n(input.documentNumber) as any;
    input.currency = n(input.currency) as any;
    input.extractionStatus = n(input.extractionStatus) as any;
    input.extractionNotes = n(input.extractionNotes) as any;
    input.duplicateCheckStatus = n(input.duplicateCheckStatus) as any;
    input.idempotencyToken = n(input.idempotencyToken) as any;
    input.receiptAvailable = nb(input.receiptAvailable) as any;
    input.manuallyReviewed = nb(input.manuallyReviewed) as any;
    input.extractionConfidence = nn(input.extractionConfidence) as any;

    if (!isValidDate(input.expenseDate)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid expense date. Use a valid date in YYYY-MM-DD format.' });

    // ACHU-123: Monetary precision — reject > 2 decimal places
    if (!isValidMoneyAmount(input.amount)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Amount must have at most 2 decimal places (e.g. 10.50).' });
    }
    input.amount = monetaryRound(input.amount);

    // ACHU-085: Subtotal validation
    if (input.subtotal !== undefined && input.subtotal !== null) {
      if (input.subtotal < 0) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Subtotal cannot be negative.' });
      if (!isValidMoneyAmount(input.subtotal)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Subtotal must have at most 2 decimal places.' });
      input.subtotal = monetaryRound(input.subtotal);
    }

    // ACHU-085: VAT Amount validation
    if (input.vatAmount !== undefined && input.vatAmount !== null) {
      if (input.vatAmount < 0) throw new ZiteError({ code: 'BAD_REQUEST', message: 'VAT amount cannot be negative.' });
      if (!isValidMoneyAmount(input.vatAmount)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'VAT amount must have at most 2 decimal places.' });
      input.vatAmount = monetaryRound(input.vatAmount);
    }

    // ACHU-085: VAT must not exceed amount
    if (input.vatAmount != null && input.vatAmount > input.amount) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'VAT amount cannot exceed total amount.' });
    }

    // ACHU-085: Subtotal + VAT consistency check (penny-safe tolerance)
    if (input.subtotal != null && input.vatAmount != null) {
      const sumPence = toPence(input.subtotal) + toPence(input.vatAmount);
      const amountPence = toPence(input.amount);
      if (Math.abs(sumPence - amountPence) > 1) { // 1 penny tolerance
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: `Subtotal (£${input.subtotal.toFixed(2)}) + VAT (£${input.vatAmount.toFixed(2)}) = £${(input.subtotal + input.vatAmount).toFixed(2)} does not match total amount (£${input.amount.toFixed(2)}).`,
        });
      }
    }

    // ACHU-085: Extraction Confidence 0–100
    if (input.extractionConfidence != null) {
      if (!Number.isFinite(input.extractionConfidence) || input.extractionConfidence < 0 || input.extractionConfidence > 100) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Extraction confidence must be between 0 and 100.' });
      }
      input.extractionConfidence = Math.round(input.extractionConfidence);
    }

    // ACHU-086: Categorical validation — central allow-lists
    if (input.category && !(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid category: ${input.category}` });
    }
    if (input.paymentMethod && !(EXPENSE_PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid expense payment method: ${input.paymentMethod}` });
    }
    if (input.documentType && !(EXPENSE_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid document type: ${input.documentType}` });
    }
    if (input.currency && !(EXPENSE_CURRENCIES as readonly string[]).includes(input.currency)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid currency: ${input.currency}. Allowed: ${EXPENSE_CURRENCIES.join(', ')}` });
    }
    if (input.extractionStatus && !(EXPENSE_EXTRACTION_STATUSES as readonly string[]).includes(input.extractionStatus)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid extraction status: ${input.extractionStatus}` });
    }
    if (input.duplicateCheckStatus && !(EXPENSE_DUPLICATE_CHECK_STATUSES as readonly string[]).includes(input.duplicateCheckStatus)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid duplicate check status: ${input.duplicateCheckStatus}` });
    }

    if (input.linkedJob) {
      const job = await Jobs.findOne({ id: input.linkedJob });
      if (!job) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Linked job not found' });
    }

    const voidStatus = input.voidStatus ?? 'Active';
    if (voidStatus !== 'Active' && voidStatus !== 'Voided') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Void status must be Active or Voided' });

    // Same-token idempotency
    if (input.idempotencyToken && !input.id) {
      const existing = await Expenses.findOne({ filters: { idempotencyToken: input.idempotencyToken } });
      if (existing) return { success: true, id: existing.id };
    }

    // Duplicate detection
    const isCreating = !input.id;
    const isActiveExpense = voidStatus === 'Active';
    let duplicateMatches: DuplicateMatch[] = [];
    let shouldCheckDuplicates = isActiveExpense;

    if (input.id) {
      const existing = await Expenses.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Expense not found' });
      const materialChanged =
        existing.expenseDate !== input.expenseDate ||
        normalizeSupplier(existing.supplier ?? '') !== normalizeSupplier(input.supplier) ||
        monetaryRound(existing.amount ?? 0) !== monetaryRound(input.amount);
      shouldCheckDuplicates = isActiveExpense && materialChanged;
    }

    if (shouldCheckDuplicates) {
      duplicateMatches = await findDuplicates({
        expenseDate: input.expenseDate, supplier: input.supplier, amount: input.amount,
        documentNumber: input.documentNumber, linkedJob: input.linkedJob,
        category: input.category, excludeId: input.id,
      });
      if (duplicateMatches.length > 0 && !input.duplicateOverrideConfirmed) {
        return { success: false, id: '', duplicateConflict: true, duplicates: duplicateMatches };
      }
    }

    // Build record
    const record: Record<string, unknown> = {
      expenseDate: input.expenseDate,
      supplier: input.supplier.trim(),
      category: input.category ?? undefined,
      description: input.description?.trim() ?? undefined,
      amount: input.amount,
      paymentMethod: input.paymentMethod?.trim() ?? undefined,
      paidBy: input.paidBy?.trim() ?? undefined,
      linkedJob: input.linkedJob ?? undefined,
      receiptAvailable: input.receiptAvailable ?? false,
      notes: input.notes?.trim() ?? undefined,
      updatedBy: context.user.email,
    };

    if (input.receiptFileUrl) {
      record.receiptFile = [{ url: input.receiptFileUrl }];
      record.receiptAvailable = true;
    } else if (input.removeReceipt) {
      record.receiptFile = [];
      record.receiptAvailable = false;
    }
    if (input.documentType !== undefined) record.documentType = input.documentType ?? undefined;
    if (input.documentNumber !== undefined) record.documentNumber = input.documentNumber?.trim() ?? undefined;
    if (input.subtotal !== undefined) record.subtotal = input.subtotal;
    if (input.vatAmount !== undefined) record.vatAmount = input.vatAmount;
    if (input.currency !== undefined) record.currency = input.currency ?? undefined;
    if (input.extractionStatus !== undefined) record.extractionStatus = input.extractionStatus ?? undefined;
    if (input.extractionConfidence !== undefined) record.extractionConfidence = input.extractionConfidence;
    if (input.extractionNotes !== undefined) record.extractionNotes = input.extractionNotes;
    if (input.manuallyReviewed !== undefined) record.manuallyReviewed = input.manuallyReviewed;

    // Duplicate override metadata
    if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
      record.duplicateCheckStatus = 'Reviewed — Saved Anyway';
      record.duplicateOverrideBy = context.user.email;
      record.duplicateOverrideAt = new Date().toISOString();
      record.duplicateMatchedExpenseIDs = duplicateMatches.map(d => `#${d.expenseId}`).join(', ');
    } else if (duplicateMatches.length === 0 && shouldCheckDuplicates) {
      record.duplicateCheckStatus = input.duplicateCheckStatus ?? 'Confirmed Unique';
    } else if (input.duplicateCheckStatus) {
      record.duplicateCheckStatus = input.duplicateCheckStatus;
    }

    // ─── UPDATE ───
    if (input.id) {
      const existing = await Expenses.findOne({ id: input.id });
      if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Expense not found' });

      // ACHU-058: Optimistic concurrency — mandatory on updates
      const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.expense);
      if (revCheck === 'missing') throw new ZiteError({ code: 'BAD_REQUEST', message: 'Revision is required for updates. Reload the record and try again.' });
      if (revCheck === 'stale') throw new ZiteError({ code: 'CONFLICT', message: 'This record has been modified by another user. Reload the latest version before saving.' });

      const submitted: Record<string, unknown> = {
        expenseDate: input.expenseDate, supplier: input.supplier.trim(),
        category: input.category ?? undefined, amount: input.amount,
        paymentMethod: input.paymentMethod?.trim() ?? undefined,
        paidBy: input.paidBy?.trim() ?? undefined, linkedJob: input.linkedJob ?? undefined, voidStatus,
      };
      let materialChange = false;
      for (const field of MATERIAL_FIELDS) {
        const oldVal = field === 'linkedJob'
          ? (Array.isArray(existing.linkedJob) ? existing.linkedJob[0] : existing.linkedJob)
          : (existing as any)[field];
        if (String(oldVal ?? '') !== String(submitted[field] ?? '')) { materialChange = true; break; }
      }
      if (materialChange && !input.correctionNotes?.trim()) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Correction notes are required when making material changes to an expense.' });
      }

      record.voidStatus = voidStatus;
      if (input.correctionNotes?.trim()) record.correctionNotes = input.correctionNotes.trim();

      // ACHU-017: Compute new signature; use override signature if Save Anyway confirmed
      const newSig = computeExpenseSignature(input.expenseDate, input.supplier, input.amount);
      if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
        record.duplicateSignature = `${newSig}:ovr:${Date.now()}`;
      } else {
        record.duplicateSignature = newSig;
      }

      await Expenses.update({ id: input.id, record });

      // Extended audit comparison — all material editable fields
      const expAuditFields = [
        'expenseDate', 'supplier', 'category', 'description', 'amount', 'paymentMethod',
        'paidBy', 'linkedJob', 'receiptAvailable', 'documentType', 'documentNumber',
        'subtotal', 'vatAmount', 'currency', 'extractionStatus', 'extractionConfidence',
        'extractionNotes', 'manuallyReviewed', 'notes', 'voidStatus',
      ] as const;
      const expPrev: Record<string, unknown> = {};
      const expNew: Record<string, unknown> = {};
      for (const f of expAuditFields) {
        const linkedFields = ['linkedJob'];
        const oldV = linkedFields.includes(f)
          ? (Array.isArray((existing as any)[f]) ? (existing as any)[f][0] : (existing as any)[f])
          : (existing as any)[f];
        const hasNewValue = f === 'voidStatus' || Object.prototype.hasOwnProperty.call(record, f);
        const newV = hasNewValue ? (f === 'voidStatus' ? voidStatus : (record as any)[f]) : oldV;
        const oldStr = (oldV == null || oldV === '') ? '' : String(oldV);
        const newStr = (newV == null || newV === '') ? '' : String(newV);
        if (oldStr !== newStr) { expPrev[f] = oldV ?? null; expNew[f] = newV ?? null; }
      }
      const auditWarning = await logAuditSafe({
        entityType: 'Expense', entityId: input.id, action: 'expense_edited',
        performedBy: context.user.email,
        summary: `Expense #${existing.expenseId} edited`,
        previousValues: Object.keys(expPrev).length > 0 ? expPrev : { amount: existing.amount },
        newValues: Object.keys(expNew).length > 0 ? expNew : { amount: input.amount },
        correctionNotes: input.correctionNotes?.trim(),
      });
      if (input.receiptFileUrl && !existing.receiptFile?.length) {
        await logAuditBestEffort({ entityType: 'Expense', entityId: input.id, action: 'receipt_uploaded', performedBy: context.user.email, summary: `Receipt uploaded for Expense #${existing.expenseId}` });
      } else if (input.receiptFileUrl && existing.receiptFile?.length) {
        await logAuditBestEffort({ entityType: 'Expense', entityId: input.id, action: 'receipt_replaced', performedBy: context.user.email, summary: `Receipt replaced for Expense #${existing.expenseId}` });
      } else if (input.removeReceipt && existing.receiptFile?.length) {
        await logAuditBestEffort({ entityType: 'Expense', entityId: input.id, action: 'receipt_removed', performedBy: context.user.email, summary: `Receipt removed from Expense #${existing.expenseId}` });
      }
      if (input.manuallyReviewed === true && !existing.manuallyReviewed) {
        await logAuditBestEffort({ entityType: 'Expense', entityId: input.id, action: 'receipt_reviewed', performedBy: context.user.email, summary: `Expense #${existing.expenseId} marked as reviewed` });
      }
      return { success: true, id: input.id, auditWarning };
    }

    // ─── CREATE ───
    record.createdBy = context.user.email;
    record.voidStatus = 'Active';
    if (input.idempotencyToken) record.idempotencyToken = input.idempotencyToken;

    // ACHU-017: Compute deterministic duplicate signature
    const sig = computeExpenseSignature(input.expenseDate, input.supplier, input.amount);
    record.duplicateSignature = (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed)
      ? `${sig}:ovr:${Date.now()}`
      : sig;

    const created = await Expenses.create({ record: record as any });

    const auditWarning = await logAuditSafe({
      entityType: 'Expense', entityId: created.id, action: 'expense_created',
      performedBy: context.user.email,
      summary: `Expense created: ${input.supplier} £${input.amount.toFixed(2)}`,
      newValues: { amount: input.amount, supplier: input.supplier, expenseDate: input.expenseDate },
    });
    if (input.receiptFileUrl) {
      await logAuditBestEffort({ entityType: 'Expense', entityId: created.id, action: 'receipt_uploaded', performedBy: context.user.email, summary: 'Receipt uploaded with new expense' });
    }
    if (duplicateMatches.length > 0 && input.duplicateOverrideConfirmed) {
      await logAuditBestEffort({
        entityType: 'Expense', entityId: created.id, action: 'expense_duplicate_override',
        performedBy: context.user.email,
        summary: `Duplicate override: saved despite matching ${duplicateMatches.map(d => '#' + d.expenseId).join(', ')}`,
      });
    }
    return { success: true, id: created.id, auditWarning };
  },
});
