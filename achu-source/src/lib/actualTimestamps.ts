/**
 * Shared helper — records actualStartTime / actualFinishTime when job status changes.
 * Used by both Admin (saveJob, updateJobStatus) and Cleaner (updateJobStatus) paths
 * so actual-timestamp logic cannot drift between portals.
 */
import { ukNowStamp } from './ukDate';

/**
 * Given a status transition and the current job record, returns the fields
 * that should be merged into the update record, plus audit-worthy changes.
 *
 * Rules:
 * - "In Progress" → set actualStartTime if empty
 * - "Completed"   → set actualFinishTime if empty; also set actualStartTime if empty
 * - Never overwrites existing values
 * - Never touches scheduled startTime / finishTime
 */
export function buildActualTimestampFields(
  newStatus: string,
  existingJob: { actualStartTime?: string | null; actualFinishTime?: string | null },
): { record: Record<string, string>; auditPrev: Record<string, unknown>; auditNew: Record<string, unknown> } {
  const record: Record<string, string> = {};
  const auditPrev: Record<string, unknown> = {};
  const auditNew: Record<string, unknown> = {};
  const stamp = ukNowStamp();

  if (newStatus === 'In Progress') {
    if (!existingJob.actualStartTime) {
      record.actualStartTime = stamp;
      auditPrev.actualStartTime = null;
      auditNew.actualStartTime = stamp;
    }
  }

  if (newStatus === 'Completed') {
    if (!existingJob.actualStartTime) {
      record.actualStartTime = stamp;
      auditPrev.actualStartTime = null;
      auditNew.actualStartTime = stamp;
    }
    if (!existingJob.actualFinishTime) {
      record.actualFinishTime = stamp;
      auditPrev.actualFinishTime = null;
      auditNew.actualFinishTime = stamp;
    }
  }

  return { record, auditPrev, auditNew };
}

