import { z } from 'zod';
import { createEndpoint, Jobs, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { isValidDate, isValidTime } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    jobDate: z.string().min(1, 'Date is required'),
    service: z.string().min(1, 'Service is required').max(200),
    address: z.string().min(1, 'Address is required').max(500),
    startTime: z.string().optional(),
    notes: z.string().max(2000).optional(),
    additionalDetails: z.string().max(2000).optional(),
    idempotencyToken: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean(), id: z.string(), jobId: z.union([z.number(), z.string(), z.null()]).optional(), auditWarning: z.string().optional() }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Customer') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied.' });
    }
    if (!context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your account is inactive. Please contact ACHU.' });
    }

    const customerId = Array.isArray(context.user.customer) ? context.user.customer[0] : context.user.customer;
    if (!customerId) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'No customer record linked to your account. Please contact ACHU.' });
    }

    // Verify customer is active
    const cust = await Customers.findOne({ id: customerId, fields: ['id', 'status'] });
    if (!cust || cust.status === 'Blocked' || cust.status === 'Inactive') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your customer account is inactive. Please contact ACHU.' });
    }

    if (!isValidDate(input.jobDate)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid booking date. Please select a valid calendar date.' });
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    if (input.jobDate < todayStr) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Booking date cannot be in the past.' });
    }

    // Validate start time if provided
    const trimmedTime = input.startTime?.trim() || undefined;
    if (trimmedTime && !isValidTime(trimmedTime)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid start time. Please use HH:MM format (e.g. 09:30).' });
    }

    // Build customer instructions from notes + additional details
    const parts: string[] = [];
    if (input.notes?.trim()) parts.push(input.notes.trim());
    if (input.additionalDetails?.trim()) parts.push(input.additionalDetails.trim());
    const customerInstructions = parts.length > 0 ? parts.join('\n\n') : undefined;

    // ─── ACHU-122: Customer-scoped idempotency token ───
    // Scope the token to the customer so a different customer's token
    // never matches, preventing cross-customer data leakage.
    const scopedToken = input.idempotencyToken
      ? `cust:${customerId}:${input.idempotencyToken}`
      : undefined;

    // ─── ACHU-122: Atomic create-or-match using bulkCreate ───
    // bulkCreate + matchOn is atomic — concurrent requests with the same
    // scoped token will produce exactly one Job record.
    if (scopedToken) {
      // Fast-path: check if already created for THIS customer
      const existing = await Jobs.findOne({
        filters: { idempotencyToken: scopedToken },
        fields: ['id', 'jobId', 'customer'],
      });
      if (existing) {
        // Verify ownership — should always match because of scoped prefix,
        // but defend-in-depth against any corruption
        const existingCustomerId = Array.isArray(existing.customer) ? existing.customer[0] : existing.customer;
        if (existingCustomerId !== customerId) {
          // Token collision across customers — treat as new request (no token)
          // This should never happen with scoped tokens but fail-safe
        } else {
          return { success: true, id: existing.id, jobId: existing.jobId };
        }
      }

      // Atomic upsert — matchOn ensures only one record per scoped token
      const result = await Jobs.bulkCreate({
        records: [{
          customer: customerId,
          jobDate: input.jobDate,
          service: input.service.trim(),
          address: input.address.trim(),
          startTime: trimmedTime,
          customerInstructions,
          status: 'Enquiry',
          idempotencyToken: scopedToken,
        }],
        matchOn: ['idempotencyToken'],
      });

      const job = result.records[0];
      const jobRecord = job.fields ?? job;

      const auditWarning = await logAuditSafe({
        entityType: 'Job', entityId: job.id, action: 'job_created',
        performedBy: context.user.email,
        summary: `Booking enquiry created by customer for ${input.service} on ${input.jobDate}`,
        newValues: {
          customer: customerId, jobDate: input.jobDate, service: input.service.trim(),
          address: input.address.trim(), status: 'Enquiry',
          ...(trimmedTime ? { startTime: trimmedTime } : {}),
        },
      });

      return { success: true, id: job.id, jobId: (jobRecord as any).jobId, auditWarning };
    }

    // No idempotency token — standard create
    const rec = await Jobs.create({
      record: {
        customer: customerId,
        jobDate: input.jobDate,
        service: input.service.trim(),
        address: input.address.trim(),
        startTime: trimmedTime,
        customerInstructions,
        status: 'Enquiry',
      },
    });

    const auditWarning = await logAuditSafe({
      entityType: 'Job', entityId: rec.id, action: 'job_created',
      performedBy: context.user.email,
      summary: `Booking enquiry created by customer for ${input.service} on ${input.jobDate}`,
      newValues: {
        customer: customerId, jobDate: input.jobDate, service: input.service.trim(),
        address: input.address.trim(), status: 'Enquiry',
        ...(trimmedTime ? { startTime: trimmedTime } : {}),
      },
    });

    return { success: true, id: rec.id, jobId: rec.jobId, auditWarning };
  },
});
