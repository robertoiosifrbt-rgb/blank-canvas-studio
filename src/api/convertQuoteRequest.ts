import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zite-integrations-backend-sdk';
import { convertEligibleQuoteRequests } from '../lib/quoteRequestConverter';

/**
 * ACHU-079/091/093/094 — Convert eligible Quote Requests into Customers + Jobs.
 *
 * Only converts Quote Requests with conversion-eligible statuses (ACHU-091).
 * Paginates through the full queue (ACHU-093).
 * Returns per-record error information (ACHU-094).
 */
export default createEndpoint({
  authenticated: true,
  description: 'Convert all eligible Quote Requests into Customers + Jobs',
  inputSchema: z.object({}),
  outputSchema: z.object({
    converted: z.number(),
    skipped: z.number(),
    failed: z.number(),
    remaining: z.number(),
    items: z.array(z.object({
      quoteRequestId: z.string(),
      displayId: z.string(),
      outcome: z.enum(['converted', 'skipped', 'failed', 'resumed']),
      reason: z.string().optional(),
      customerId: z.string().optional(),
      jobId: z.string().optional(),
      userAccountId: z.string().optional(),
    })).optional(),
    errors: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const result = await convertEligibleQuoteRequests(context.user.email);

    return {
      converted: result.converted,
      skipped: result.skipped,
      failed: result.failed,
      remaining: result.remaining,
      items: result.items.length > 0 ? result.items : undefined,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  },
});
