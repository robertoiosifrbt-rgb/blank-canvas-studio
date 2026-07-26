import { z } from 'zod';
import { createEndpoint, Customers, ZiteError } from 'zite-integrations-backend-sdk';
import { LIMITS, normalizePhone } from '../lib/validation';
import { logAuditSafe } from '../lib/audit';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    phone: z.string().min(1, 'Phone is required').max(LIMITS.phone),
    address: z.string().min(1, 'Address is required').max(LIMITS.address),
    // ACHU-121: postcode supports 3 states:
    //   undefined = leave unchanged
    //   non-empty string = update
    //   empty string or null = clear
    postcode: z.string().max(20).optional().nullable(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    customer: z.object({
      customerName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postcode: z.string().optional().nullable(),
      customerType: z.string().optional(),
      status: z.string().optional(),
    }),
    auditWarning: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Customer') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied.' });
    }
    if (!context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your account is currently inactive. Please contact ACHU.' });
    }

    const customerId = Array.isArray(context.user.customer) ? context.user.customer[0] : context.user.customer;
    if (!customerId) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'No customer record linked to your account. Please contact ACHU.' });
    }

    const existing = await Customers.findOne({ id: customerId, fields: ['id', 'customerName', 'email', 'phone', 'address', 'postcode', 'customerType', 'status'] });
    if (!existing) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Customer record not found. Please contact ACHU.' });
    }
    if (existing.status === 'Blocked' || existing.status === 'Inactive') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Your account is currently inactive. Please contact ACHU.' });
    }

    const phone = (normalizePhone(input.phone) ?? '').trim();
    const address = input.address.trim();

    if (!phone) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Phone cannot be empty.' });
    if (!address) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Address cannot be empty.' });
    if (phone.length > LIMITS.phone) throw new ZiteError({ code: 'BAD_REQUEST', message: `Phone cannot exceed ${LIMITS.phone} characters.` });
    if (address.length > LIMITS.address) throw new ZiteError({ code: 'BAD_REQUEST', message: `Address cannot exceed ${LIMITS.address} characters.` });

    // ACHU-121: 3-state postcode handling
    // undefined → leave unchanged, empty/null → clear, non-empty → update
    const record: Record<string, unknown> = { phone, address };
    let postcodeValue: string | null | undefined;
    if (input.postcode === undefined) {
      // Omitted — leave unchanged
      postcodeValue = undefined;
    } else if (input.postcode === null || input.postcode.trim() === '') {
      // Explicit clear
      postcodeValue = null;
      record.postcode = null;
    } else {
      // Update
      postcodeValue = input.postcode.trim();
      record.postcode = postcodeValue;
    }

    await Customers.update({ id: customerId, record });

    // ACHU-121: Re-read persisted record — do not rebuild from stale request data
    const persisted = await Customers.findOne({ id: customerId, fields: ['id', 'customerName', 'email', 'phone', 'address', 'postcode', 'customerType', 'status'] });

    // Audit only changed fields
    const prevVals: Record<string, unknown> = {};
    const newVals: Record<string, unknown> = {};
    if ((existing.phone ?? '') !== phone) { prevVals.phone = existing.phone ?? null; newVals.phone = phone; }
    if ((existing.address ?? '') !== address) { prevVals.address = existing.address ?? null; newVals.address = address; }
    const oldPostcode = existing.postcode ?? null;
    const newPostcode = postcodeValue === undefined ? oldPostcode : (postcodeValue ?? null);
    if (oldPostcode !== newPostcode) { prevVals.postcode = oldPostcode; newVals.postcode = newPostcode; }

    let auditWarning: string | undefined;
    if (Object.keys(newVals).length > 0) {
      auditWarning = await logAuditSafe({
        entityType: 'Customer', entityId: customerId, action: 'customer_profile_updated',
        performedBy: context.user.email,
        summary: `Customer "${existing.customerName}" updated profile`,
        previousValues: prevVals, newValues: newVals,
      });
    }

    return {
      success: true,
      customer: {
        customerName: persisted?.customerName ?? existing.customerName,
        email: persisted?.email ?? existing.email,
        phone: persisted?.phone ?? phone,
        address: persisted?.address ?? address,
        postcode: persisted?.postcode ?? null,
        customerType: persisted?.customerType ?? existing.customerType,
        status: persisted?.status ?? existing.status,
      },
      auditWarning,
    };
  },
});
