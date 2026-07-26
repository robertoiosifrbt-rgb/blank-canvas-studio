import { z } from 'zod';
import { createEndpoint, UserAccounts, Customers, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { userAccountRecordSchema } from '../lib/zodSchemas';
import { normalizeEmail, extractId } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    records: z.array(userAccountRecordSchema),
    customers: z.array(z.object({ id: z.string(), customerName: z.string().optional() }).passthrough()),
    cleaners: z.array(z.object({ id: z.string(), cleanerName: z.string().optional() }).passthrough()),
  }),
  execute: async ({ context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    const [allUsers, allCusts, allCleaners] = await Promise.all([
      fetchAll((p) => UserAccounts.findAll(p)),
      fetchAll((p) => Customers.findAll(p), { fields: ['id', 'customerName'] }),
      fetchAll((p) => Cleaners.findAll(p), { fields: ['id', 'cleanerName'] }),
    ]);
    const custMap: Record<string, string> = {};
    allCusts.forEach(c => { custMap[c.id] = c.customerName ?? ''; });
    const clMap: Record<string, string> = {};
    allCleaners.forEach(c => { clMap[c.id] = c.cleanerName ?? ''; });

    // ACHU-030: Detect duplicate normalized emails
    const emailCounts: Record<string, number> = {};
    for (const u of allUsers) {
      const ne = normalizeEmail(u.email ?? '');
      emailCounts[ne] = (emailCounts[ne] || 0) + 1;
    }

    const records = allUsers.map(u => {
      const custId = extractId(u.customer);
      const clId = extractId(u.cleaner);
      const ne = normalizeEmail(u.email ?? '');
      return {
        ...u,
        customerName: custMap[custId ?? ''] ?? '',
        cleanerName: clMap[clId ?? ''] ?? '',
        duplicateEmail: (emailCounts[ne] ?? 0) > 1,
      };
    }).sort((a, b) => defaultSort(a, b, 'userAccountId'));
    return { records, customers: allCusts, cleaners: allCleaners };
  },
});
