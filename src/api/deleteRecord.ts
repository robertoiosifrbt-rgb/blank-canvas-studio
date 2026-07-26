import { z } from 'zod';
import { createEndpoint, Customers, Jobs, Payments, Expenses, JobAssignments, UserAccounts, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    table: z.enum(['customers', 'jobs', 'payments', 'expenses']),
    id: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ACHU-009: Payments cannot be permanently deleted
    if (input.table === 'payments') {
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'Payment records cannot be permanently deleted. Use Void or correction actions.',
      });
    }

    // ACHU-016: Expenses cannot be permanently deleted — same protection as Payments
    if (input.table === 'expenses') {
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'Expense records cannot be permanently deleted. Use Void / Restore to manage expense status.',
      });
    }

    let auditWarning: string | undefined;

    if (input.table === 'customers') {
      const [jobCheck, payCheck, uaCheck] = await Promise.all([
        Jobs.findAll({ limit: 1, filters: { customer: input.id } }),
        Payments.findAll({ limit: 1, filters: { customer: input.id } }),
        UserAccounts.findAll({ limit: 1, filters: { customer: input.id } }),
      ]);
      const linked: string[] = [];
      if (jobCheck.records.length > 0) linked.push('Jobs');
      if (payCheck.records.length > 0) linked.push('Payments');
      if (uaCheck.records.length > 0) linked.push('User Accounts');
      if (linked.length > 0) {
        throw new ZiteError({
          code: 'CONFLICT',
          message: `Cannot delete this customer. Related records exist: ${linked.join(', ')}. Set the customer to Inactive instead.`,
        });
      }

      // ACHU-070: Snapshot before deletion, audit AFTER deletion
      const customer = await Customers.findOne({ id: input.id });
      const snapshot = customer ? {
        customerName: customer.customerName ?? null,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        status: customer.status ?? null,
      } : { id: input.id };

      await Customers.delete({ id: input.id });

      auditWarning = await logAuditSafe({
        entityType: 'Customer', entityId: input.id, action: 'customer_deleted',
        performedBy: context.user.email,
        summary: `Customer "${customer?.customerName ?? input.id}" permanently deleted`,
        previousValues: snapshot,
      });
    } else if (input.table === 'jobs') {
      const [payCheck, expCheck, jaCheck] = await Promise.all([
        Payments.findAll({ limit: 1, filters: { job: input.id } }),
        Expenses.findAll({ limit: 1, filters: { linkedJob: input.id } }),
        JobAssignments.findAll({ limit: 1, filters: { job: input.id } }),
      ]);
      const linked: string[] = [];
      if (payCheck.records.length > 0) linked.push('Payments');
      if (expCheck.records.length > 0) linked.push('Expenses');
      if (jaCheck.records.length > 0) linked.push('Job Assignments');
      if (linked.length > 0) {
        throw new ZiteError({
          code: 'CONFLICT',
          message: `Cannot delete this job. Related records exist: ${linked.join(', ')}. Set the job to Cancelled instead.`,
        });
      }

      // ACHU-070: Snapshot before deletion, audit AFTER deletion
      const job = await Jobs.findOne({ id: input.id });
      const snapshot = job ? {
        jobId: job.jobId ?? null,
        service: job.service ?? null,
        jobDate: job.jobDate ?? null,
        status: job.status ?? null,
        amountCharged: job.amountCharged ?? null,
      } : { id: input.id };

      await Jobs.delete({ id: input.id });

      auditWarning = await logAuditSafe({
        entityType: 'Job', entityId: input.id, action: 'job_deleted',
        performedBy: context.user.email,
        summary: `Job #${job?.jobId ?? input.id} permanently deleted`,
        previousValues: snapshot,
      });
    }

    return { success: true, auditWarning };
  },
});
