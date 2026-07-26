import { z } from 'zod';
import { createEndpoint, JobAssignments, Cleaners, JobChecklistItems, Jobs, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { extractId } from '../lib/validation';
import { ensureJobChecklist } from '../lib/ensureJobChecklist';

const checklistItemSchema = z.object({
  id: z.string(),
  itemKey: z.string(),
  groupName: z.string(),
  itemLabel: z.string(),
  sourceField: z.string(),
  itemIndex: z.number(),
  completed: z.boolean(),
  completedBy: z.string().nullable(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  notApplicable: z.boolean(),
  notApplicableReason: z.string().nullable(),
  obsolete: z.boolean(),
});

const groupSchema = z.object({
  groupName: z.string(),
  items: z.array(checklistItemSchema),
});

export default createEndpoint({
  authenticated: true,
  description: 'Fetch checklist items for a Job — Cleaner or Admin access',
  inputSchema: z.object({ jobId: z.string().min(1) }),
  outputSchema: z.object({
    groups: z.array(groupSchema),
    completed: z.number(),
    total: z.number(),
    hasChecklist: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    if (!context.user.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    const isAdmin = context.user.role === 'Admin';
    const isCleaner = context.user.role === 'Cleaner';
    if (!isAdmin && !isCleaner) throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });

    // Cleaner access check
    if (isCleaner) {
      const cleanerId = extractId(context.user.cleaner);
      if (!cleanerId) throw new ZiteError({ code: 'FORBIDDEN', message: 'No cleaner record linked' });
      const cleaner = await Cleaners.findOne({ id: cleanerId, fields: ['id', 'active'] });
      if (!cleaner || !cleaner.active) throw new ZiteError({ code: 'FORBIDDEN', message: 'Your cleaner account is not active' });
      const assignment = await JobAssignments.findOne({ filters: { job: input.jobId, cleaner: cleanerId } });
      if (!assignment) throw new ZiteError({ code: 'FORBIDDEN', message: 'You are not assigned to this job' });
    }

    // ACHU-117: Check if checklist items exist before generating
    const job = await Jobs.findOne({ id: input.jobId, fields: ['id', 'quoteRequests'] });
    if (!job) throw new ZiteError({ code: 'NOT_FOUND', message: 'Job not found' });
    const qrId = extractId(job.quoteRequests);
    if (!qrId) return { groups: [], completed: 0, total: 0, hasChecklist: false };

    // Only generate if no items exist yet (lazy generation — avoids writes on read-only loads)
    const probe = await JobChecklistItems.findAll({ filters: { job: input.jobId }, limit: 1 });
    if (probe.records.length === 0) {
      await ensureJobChecklist(input.jobId, context.user.email);
    }

    // Load all items
    const items = await fetchAll(
      (p) => JobChecklistItems.findAll(p),
      { filters: { job: input.jobId } },
    );

    // Filter out obsolete for display, sort by itemIndex
    const active = items
      .filter(i => !i.obsolete)
      .sort((a, b) => (a.itemIndex ?? 0) - (b.itemIndex ?? 0));

    // Group by groupName preserving FIELD_MAP order
    const groupOrder: string[] = [];
    const groupMap = new Map<string, typeof active>();
    for (const item of active) {
      const gn = item.groupName ?? 'Other';
      if (!groupMap.has(gn)) {
        groupOrder.push(gn);
        groupMap.set(gn, []);
      }
      groupMap.get(gn)!.push(item);
    }

    const groups = groupOrder.map(gn => ({
      groupName: gn,
      items: groupMap.get(gn)!.map(i => ({
        id: i.id,
        itemKey: i.itemKey ?? '',
        groupName: i.groupName ?? '',
        itemLabel: i.itemLabel ?? '',
        sourceField: i.sourceField ?? '',
        itemIndex: i.itemIndex ?? 0,
        completed: i.completed ?? false,
        completedBy: i.completedBy ?? null,
        completedAt: i.completedAt ?? null,
        notes: i.notes ?? null,
        notApplicable: i.notApplicable ?? false,
        notApplicableReason: i.notApplicableReason ?? null,
        obsolete: i.obsolete ?? false,
      })),
    }));

    const total = active.length;
    const completed = active.filter(i => i.completed || i.notApplicable).length;

    return { groups, completed, total, hasChecklist: true };
  },
});
