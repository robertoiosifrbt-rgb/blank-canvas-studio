import { z } from 'zod';
import { createEndpoint, QuoteRequests, ZiteError } from 'zite-integrations-backend-sdk';
import { logAuditSafe } from '../lib/audit';
import { checkRevision, computeRevision, REVISION_FIELDS } from '../lib/concurrency';

/**
 * ACHU-058 — Protected save endpoint for Quote Requests.
 *
 * Enforces optimistic concurrency via the shared revision mechanism.
 * Only allows updates (QRs are created by Fillout form submissions).
 * Returns the new _revision after a successful write.
 */
export default createEndpoint({
  authenticated: true,
  description: 'Update a Quote Request with optimistic concurrency protection',
  inputSchema: z.object({
    id: z.string().min(1),
    _revision: z.string().optional(),
    // Editable fields
    status: z.string().optional(),
    fullName: z.string().max(200).optional(),
    email: z.string().max(254).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(500).optional(),
    postcode: z.string().max(20).optional(),
    customerType: z.string().optional(),
    preferredDate: z.string().optional(),
    preferredTime: z.string().optional(),
    propertyDetails: z.string().max(5000).optional(),
    additionalNotes: z.string().max(5000).optional(),
    serviceDetails: z.string().max(5000).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    _revision: z.string(),
    auditWarning: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const existing = await QuoteRequests.findOne({ id: input.id });
    if (!existing) {
      throw new ZiteError({ code: 'NOT_FOUND', message: 'Quote Request not found' });
    }

    // ACHU-058: Optimistic concurrency — mandatory on updates
    const revCheck = checkRevision(input._revision, existing, REVISION_FIELDS.quoteRequest);
    if (revCheck === 'missing') {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Revision is required for updates. Reload the record and try again.',
      });
    }
    if (revCheck === 'stale') {
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'This record has been modified by another user. Reload the latest version before saving.',
      });
    }

    // Build update record from provided fields only
    const record: Record<string, unknown> = {};
    if (input.status !== undefined) record.status = input.status;
    if (input.fullName !== undefined) record.fullName = input.fullName.trim();
    if (input.email !== undefined) record.email = input.email.trim().toLowerCase() || undefined;
    if (input.phone !== undefined) record.phone = input.phone.trim() || undefined;
    if (input.address !== undefined) record.address = input.address.trim() || undefined;
    if (input.postcode !== undefined) record.postcode = input.postcode.trim() || undefined;
    if (input.customerType !== undefined) record.customerType = input.customerType || undefined;
    if (input.preferredDate !== undefined) record.preferredDate = input.preferredDate || undefined;
    if (input.preferredTime !== undefined) record.preferredTime = input.preferredTime || undefined;
    if (input.propertyDetails !== undefined) record.propertyDetails = input.propertyDetails.trim() || undefined;
    if (input.additionalNotes !== undefined) record.additionalNotes = input.additionalNotes.trim() || undefined;
    if (input.serviceDetails !== undefined) record.serviceDetails = input.serviceDetails.trim() || undefined;

    if (Object.keys(record).length === 0) {
      // Nothing to update — return current revision
      return {
        success: true,
        id: input.id,
        _revision: computeRevision(existing, REVISION_FIELDS.quoteRequest),
      };
    }

    await QuoteRequests.update({ id: input.id, record });

    // Compute new revision from updated record
    const updated = await QuoteRequests.findOne({ id: input.id });
    const newRevision = updated
      ? computeRevision(updated, REVISION_FIELDS.quoteRequest)
      : computeRevision({ ...existing, ...record }, REVISION_FIELDS.quoteRequest);

    // Audit
    const prevVals: Record<string, unknown> = {};
    const newVals: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      const oldStr = String((existing as any)[key] ?? '');
      const newStr = String(record[key] ?? '');
      if (oldStr !== newStr) {
        prevVals[key] = (existing as any)[key];
        newVals[key] = record[key];
      }
    }

    let auditWarning: string | undefined;
    if (Object.keys(newVals).length > 0) {
      const displayId = existing.quoteRequestId != null ? `#${existing.quoteRequestId}` : input.id.slice(0, 8);
      auditWarning = await logAuditSafe({
        entityType: 'QuoteRequest',
        entityId: input.id,
        action: 'quoterequest_edited',
        performedBy: context.user.email,
        summary: `Quote Request ${displayId} edited`,
        previousValues: prevVals,
        newValues: newVals,
      });
    }

    return {
      success: true,
      id: input.id,
      _revision: newRevision,
      auditWarning,
    };
  },
});
