import { z } from 'zod';
import { createEndpoint, JobAssignments, Cleaners, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { defaultSort } from '../lib/defaultSort';
import { jobAssignmentRecordSchema } from '../lib/zodSchemas';
import { extractId } from '../lib/validation';

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({ jobId: z.string() }),
  outputSchema: z.object({ assignments: z.array(jobAssignmentRecordSchema) }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    const [allAssignments, allCleaners] = await Promise.all([
      fetchAll((p) => JobAssignments.findAll(p), { filters: { job: input.jobId } }),
      fetchAll((p) => Cleaners.findAll(p), { fields: ['id', 'cleanerName', 'phone', 'email', 'active'] }),
    ]);
    const clMap: Record<string, { name: string; phone: string; email: string; active: boolean }> = {};
    allCleaners.forEach(c => {
      clMap[c.id] = { name: c.cleanerName ?? '', phone: c.phone ?? '', email: c.email ?? '', active: c.active ?? false };
    });
    const assignments = allAssignments.map(a => {
      const clId = extractId(a.cleaner);
      const cl = clMap[clId ?? ''];
      return {
        ...a,
        cleanerName: cl?.name ?? '',
        cleanerPhone: cl?.phone ?? '',
        cleanerEmail: cl?.email ?? '',
        cleanerActive: cl?.active ?? false,
      };
    }).sort((a, b) => defaultSort(a, b, 'jobAssignmentId'));
    return { assignments };
  },
});
