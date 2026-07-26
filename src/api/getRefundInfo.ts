import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zite-integrations-backend-sdk';
import { getJobPaymentTotals } from '../lib/refundGuard';
import { fromPence } from '../lib/money';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    jobId: z.string().min(1),
    excludePaymentId: z.string().optional(),
  }),
  outputSchema: z.object({
    totalActiveReceived: z.number(),
    totalActiveRefunded: z.number(),
    maxRefundable: z.number(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // ACHU-123: Penny-safe aggregation via shared helper
    const { receivedPence, refundedPence } = await getJobPaymentTotals(input.jobId, input.excludePaymentId);

    return {
      totalActiveReceived: fromPence(receivedPence),
      totalActiveRefunded: fromPence(refundedPence),
      maxRefundable: fromPence(Math.max(0, receivedPence - refundedPence)),
    };
  },
});
