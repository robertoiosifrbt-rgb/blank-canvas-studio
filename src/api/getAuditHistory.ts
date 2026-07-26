import { z } from 'zod';
import { createEndpoint, AuditEvents, ZiteError } from 'zite-integrations-backend-sdk';
import { fetchAll } from '../lib/fetchAll';
import { isValidDate, validateOffset, validateLimit, PaginationValidationError } from '../lib/validation';
import { auditEventRecordSchema } from '../lib/zodSchemas';
import { AUDIT_ENTITY_TYPES, AUDIT_ACTIONS } from '../lib/audit';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export default createEndpoint({
  authenticated: true,
  inputSchema: z.object({
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    action: z.string().optional(),
    performedBy: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({
    events: z.array(auditEventRecordSchema),
    hasMore: z.boolean(),
    total: z.number(),
    entityTypes: z.array(z.string()),
    actions: z.array(z.string()),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    // ACHU-080: Strict validation — reject invalid values, never clamp
    let offset: number;
    let limit: number;
    try {
      offset = validateOffset(input.offset, 'offset');
      limit = validateLimit(input.limit, 'limit', DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    } catch (e) {
      if (e instanceof PaginationValidationError) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: e.message });
      }
      throw e;
    }

    // ACHU-101: Normalise "__all__" to empty (= all types)
    const entityType = (input.entityType && input.entityType !== '__all__') ? input.entityType : undefined;
    const action = (input.action && input.action !== '__all__') ? input.action : undefined;

    const filters: Record<string, unknown> = {};
    if (entityType) filters.entityType = entityType;
    if (input.entityId) filters.entityId = input.entityId;

    const all = await fetchAll(
      (p) => AuditEvents.findAll(p),
      Object.keys(filters).length > 0 ? { filters } : undefined,
    );

    let results = all;

    // Post-fetch filtering
    if (action) {
      results = results.filter(e => e.action === action);
    }
    if (input.performedBy) {
      const q = input.performedBy.toLowerCase();
      results = results.filter(e => (e.performedBy ?? '').toLowerCase().includes(q));
    }
    if (input.startDate || input.endDate) {
      if (input.startDate && !isValidDate(input.startDate)) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid start date. Use a real calendar date in YYYY-MM-DD format.' });
      }
      if (input.endDate && !isValidDate(input.endDate)) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Invalid end date. Use a real calendar date in YYYY-MM-DD format.' });
      }
      if (input.startDate && input.endDate && input.startDate > input.endDate) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: 'Start date cannot be after end date.' });
      }

      function londonDayStartUtc(dateStr: string): string {
        const [y, m, d] = dateStr.split('-').map(Number);
        if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
          throw new ZiteError({ code: 'BAD_REQUEST', message: `Invalid date: ${dateStr}` });
        }
        const midnightUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23',
        }).formatToParts(midnightUtc);
        const londonHourAtMidnightUtc = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
        const result = new Date(midnightUtc);
        result.setUTCHours(result.getUTCHours() - londonHourAtMidnightUtc);
        return result.toISOString();
      }
      if (input.startDate) {
        const startBound = londonDayStartUtc(input.startDate);
        results = results.filter(e => (e.timestamp ?? '') >= startBound);
      }
      if (input.endDate) {
        const [y, m, d] = input.endDate.split('-').map(Number);
        const nextDayDate = new Date(Date.UTC(y, m - 1, d + 1, 12));
        const nextDayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(nextDayDate);
        const endBound = londonDayStartUtc(nextDayStr);
        results = results.filter(e => (e.timestamp ?? '') < endBound);
      }
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));

    const total = results.length;

    // ACHU-102: Paginate
    const paged = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      events: paged,
      hasMore,
      total,
      entityTypes: AUDIT_ENTITY_TYPES as unknown as string[],
      actions: AUDIT_ACTIONS as unknown as string[],
    };
  },
});
