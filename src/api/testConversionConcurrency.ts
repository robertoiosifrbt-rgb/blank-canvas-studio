import { z } from 'zod';
import { createEndpoint, ZiteError, Customers, UserAccounts, Jobs, QuoteRequests } from 'zite-integrations-backend-sdk';
import { convertEligibleQuoteRequests } from '../lib/quoteRequestConverter';

/**
 * ACHU-089 — Concurrency Verification Endpoint
 *
 * Runs concurrency tests and reports record counts.
 * Admin-only diagnostic tool — not for production use.
 *
 * PLATFORM FINDING: bulkCreate+matchOn is application-level (NOT atomic upsert).
 * This endpoint verifies the post-creation reconciliation mitigation.
 */
export default createEndpoint({
  authenticated: true,
  description: 'Run ACHU-089 concurrency verification tests',
  inputSchema: z.object({
    testToRun: z.enum(['test1_same_qr', 'test2_same_email', 'verify_counts', 'platform_check']),
    quoteRequestId: z.string().optional(),
    quoteRequestId2: z.string().optional(),
  }),
  outputSchema: z.object({
    test: z.string(),
    success: z.boolean(),
    details: z.any(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin') {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Admin only' });
    }

    if (input.testToRun === 'platform_check') {
      // Report platform capabilities honestly
      return {
        test: 'Platform Capability Check',
        success: true,
        details: {
          platform: 'Zite Database (Postgres-backed)',
          uniqueConstraints: false,
          atomicUpsert: false,
          bulkCreateMatchOnBehaviour: 'APPLICATION-LEVEL find-then-create (empirically verified — concurrent calls create duplicates)',
          transactions: false,
          conditionalCreate: false,
          deterministicPrimaryIds: false,
          mitigations: [
            'Ownership tokens prevent most concurrent execution (pre-claim guard)',
            'Find-first pattern catches sequential duplicates',
            'Post-creation duplicate detection and reconciliation (find-then-delete orphans)',
            'Deterministic idempotency tokens enable duplicate Job detection',
          ],
          verdict: 'ACHU-089: PARTIAL — platform lacks database-level uniqueness enforcement. Post-creation reconciliation is the strongest available mitigation.',
        },
      };
    }

    if (input.testToRun === 'test1_same_qr') {
      // Test 1: Two concurrent conversions of the same Quote Request
      const [r1, r2] = await Promise.all([
        convertEligibleQuoteRequests(context.user.email),
        convertEligibleQuoteRequests(context.user.email),
      ]);

      return {
        test: 'Test 1 — Same QR concurrent conversion',
        success: true,
        details: {
          execution1: { converted: r1.converted, skipped: r1.skipped, failed: r1.failed, items: r1.items },
          execution2: { converted: r2.converted, skipped: r2.skipped, failed: r2.failed, items: r2.items },
          note: 'Run verify_counts with a quoteRequestId to confirm record counts after this test',
        },
      };
    }

    if (input.testToRun === 'verify_counts') {
      if (!input.quoteRequestId) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'quoteRequestId required for verify_counts' });
      }

      const qr = await QuoteRequests.findOne({ id: input.quoteRequestId });
      if (!qr) {
        throw new ZiteError({ code: 'NOT_FOUND', message: 'Quote Request not found' });
      }

      const email = qr.email?.trim().toLowerCase();
      const idempToken = `qr_conv_${input.quoteRequestId}`;

      const { records: customers } = email
        ? await Customers.findAll({ filters: { email }, limit: 100 })
        : { records: [] };
      const { records: userAccounts } = email
        ? await UserAccounts.findAll({ filters: { email }, limit: 100 })
        : { records: [] };
      const { records: jobs } = await Jobs.findAll({ filters: { idempotencyToken: idempToken }, limit: 100 });

      const customerCount = customers.length;
      const userAccountCount = userAccounts.length;
      const jobCount = jobs.length;

      const allUnique = customerCount <= 1 && userAccountCount <= 1 && jobCount <= 1;

      return {
        test: 'Verify Record Counts',
        success: allUnique,
        details: {
          quoteRequestId: input.quoteRequestId,
          email,
          idempotencyToken: idempToken,
          qrStatus: qr.status,
          qrLinkedCustomer: qr.customer,
          qrLinkedJob: qr.job,
          customerCount,
          customerIds: customers.map(c => c.id),
          userAccountCount,
          userAccountIds: userAccounts.map(u => u.id),
          jobCount,
          jobIds: jobs.map(j => j.id),
          verdict: allUnique
            ? 'PASS — No duplicates found (post-creation reconciliation succeeded or no concurrent execution occurred)'
            : `DUPLICATES PRESENT: ${customerCount} Customers, ${userAccountCount} UserAccounts, ${jobCount} Jobs. Check audit events for reconciliation details.`,
          platformNote: 'Duplicate absence may be due to ownership tokens preventing concurrent execution rather than database-level uniqueness.',
        },
      };
    }

    return { test: 'unknown', success: false, details: { error: 'Unknown test' } };
  },
});
