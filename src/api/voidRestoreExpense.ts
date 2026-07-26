import { z } from 'zod';
import { createEndpoint, Expenses, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { computeExpenseSignature } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    expenseId: z.string().min(1, 'Expense ID is required'),
    action: z.enum(['void', 'restore']),
    correctionNotes: z.string().min(1, 'Correction notes are required').max(2000),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const existing = await Expenses.findOne({ id: input.expenseId });
    if (!existing) throw new ZiteError({ code: 'NOT_FOUND', message: 'Expense not found' });

    const newVoidStatus = input.action === 'void' ? 'Voided' : 'Active';

    const updateRecord: Record<string, unknown> = {
      voidStatus: newVoidStatus,
      correctionNotes: input.correctionNotes.trim(),
      updatedBy: context.user.email,
    };

    if (input.action === 'void') {
      // ACHU-017: Clear signature so it no longer reserves the active namespace
      updateRecord.duplicateSignature = '';
    } else {
      // ACHU-017: Restore — recompute signature and check for collision
      const restoredSig = computeExpenseSignature(
        existing.expenseDate ?? '', existing.supplier ?? '', existing.amount ?? 0
      );

      // Check if another active record already owns this signature
      const allExpenses = await fetchAll(
        (p) => Expenses.findAll(p),
        { fields: ['id', 'expenseId', 'supplier', 'expenseDate', 'amount', 'voidStatus', 'duplicateSignature'] },
      );
      const conflicting = allExpenses.find(e =>
        e.id !== input.expenseId &&
        e.voidStatus !== 'Voided' &&
        e.duplicateSignature === restoredSig
      );

      if (conflicting) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: `Cannot restore: an active expense #${conflicting.expenseId} already exists with the same details (${existing.supplier}, ${existing.expenseDate}, £${(existing.amount ?? 0).toFixed(2)}). Void or edit the conflicting expense first.`,
        });
      }

      updateRecord.duplicateSignature = restoredSig;
    }

    await Expenses.update({ id: input.expenseId, record: updateRecord });

    const auditWarning = await logAuditSafe({
      entityType: 'Expense', entityId: input.expenseId,
      action: input.action === 'void' ? 'expense_voided' : 'expense_restored',
      performedBy: context.user.email,
      summary: `Expense #${existing.expenseId} ${input.action === 'void' ? 'voided' : 'restored'}`,
      previousValues: { voidStatus: existing.voidStatus, amount: existing.amount, supplier: existing.supplier },
      newValues: { voidStatus: newVoidStatus },
      correctionNotes: input.correctionNotes.trim(),
    });

    return { success: true, id: input.expenseId, auditWarning };
  },
});
