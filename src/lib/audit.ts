/**
 * Shared audit event helper — append-only audit trail for all entities.
 * ACHU-106: Single authoritative source for AuditEntityType and AuditAction.
 * Both the type and the runtime array are derived from one `as const` list.
 */
import { AuditEvents } from 'zite-integrations-backend-sdk';

// ─── ACHU-106: Single source of truth for entity types ─────────────
export const AUDIT_ENTITY_TYPES = [
  'Payment', 'Expense', 'Job', 'Customer', 'Cleaner',
  'JobAssignment', 'UserAccount', 'FinancialSettings',
  'JobChecklistItem', 'QuoteRequest',
] as const;

export type AuditEntityType = typeof AUDIT_ENTITY_TYPES[number];

// ─── ACHU-106: Single source of truth for actions ──────────────────
export const AUDIT_ACTIONS = [
  // Payment
  'payment_created', 'payment_edited', 'payment_voided', 'payment_restored', 'payment_refunded', 'payment_duplicate_override',
  // Expense
  'expense_created', 'expense_edited', 'expense_voided', 'expense_restored', 'expense_duplicate_override',
  'receipt_uploaded', 'receipt_replaced', 'receipt_removed', 'receipt_reviewed',
  // Job
  'job_created', 'job_edited', 'job_status_changed', 'job_notes_updated', 'job_deleted',
  // Customer
  'customer_created', 'customer_edited', 'customer_status_changed', 'customer_profile_updated', 'customer_deleted',
  // Cleaner
  'cleaner_created', 'cleaner_edited', 'cleaner_activated', 'cleaner_deactivated',
  // JobAssignment
  'assignment_created', 'assignment_edited', 'assignment_deleted',
  // UserAccount
  'useraccount_created', 'useraccount_edited', 'useraccount_role_changed',
  'useraccount_activated', 'useraccount_deactivated',
  'useraccount_customer_linked', 'useraccount_cleaner_linked',
  // FinancialSettings
  'financialsettings_created', 'financialsettings_edited',
  'financialsettings_activated', 'financialsettings_deactivated',
  // QuoteRequest
  'quoterequest_edited', 'quoterequest_converted', 'quoterequest_conversion_failed',
  'quoterequest_conversion_resumed', 'quoterequest_conversion_skipped',
  'quoterequest_duplicate_detected',
  // Checklist Override
  'checklist_override',
  // Completion guard
  'job_completion_rejected',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

/**
 * Logs an audit event. Throws on failure so the caller can decide
 * whether to proceed or abort the primary operation.
 */
export async function logAudit(params: {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performedBy: string;
  summary: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  correctionNotes?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditEvents.create({
    record: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      timestamp: new Date().toISOString(),
      performedBy: params.performedBy,
      summary: params.summary,
      previousValues: params.previousValues ? JSON.stringify(params.previousValues) : undefined,
      newValues: params.newValues ? JSON.stringify(params.newValues) : undefined,
      correctionNotes: params.correctionNotes,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
}

/**
 * Non-critical audit log — best-effort, logs error but does not throw.
 */
export async function logAuditBestEffort(params: Parameters<typeof logAudit>[0]): Promise<void> {
  try {
    await logAudit(params);
  } catch (e) {
    console.error('[audit] Failed to log audit event:', e);
  }
}

/**
 * Safe primary audit log — catches failures and returns a warning string.
 */
export async function logAuditSafe(params: Parameters<typeof logAudit>[0]): Promise<string | undefined> {
  try {
    await logAudit(params);
    return undefined;
  } catch (e: any) {
    const msg = e?.message || 'Unknown error';
    console.error(`[audit] Primary audit write failed for ${params.action} on ${params.entityType}/${params.entityId}: ${msg}`);
    return `Record saved but audit logging failed (${msg}). The change was applied but may not appear in audit history.`;
  }
}
