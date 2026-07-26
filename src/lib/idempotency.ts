/**
 * ACHU-116: Backend idempotency protection — reservation-based, fail-closed.
 *
 * Uses the IdempotencyTokens table as the single source of truth.
 * Tokens are RESERVED before mutation and COMPLETED after.
 *
 * Flow:
 *  1. reserveToken() — checks for existing token; if Completed returns stored
 *     result; if Pending and fresh rejects concurrent; if stale Pending
 *     reconciles entity state before deciding whether to re-reserve or
 *     mark Completed; if Failed reconciles too.
 *  2. Endpoint performs the mutation.
 *  3. completeToken() — marks the reservation Completed with the result JSON.
 *  4. On error: failToken() — marks Failed so a fresh retry is accepted.
 *
 * Fail-closed: if the token table cannot be reached the request is rejected
 * rather than allowing a potential duplicate through.
 */
import { IdempotencyTokens, ZiteError } from 'zite-integrations-backend-sdk';

/** Pending tokens older than this are treated as stale (server crashed mid-mutation). */
const STALE_THRESHOLD_MS = 30_000; // 30 seconds

export type ReserveResult =
  | { reserved: true; tokenRecordId: string }
  | { alreadyCompleted: true; result: { success: boolean; auditWarning?: string } };

/**
 * A reconcile callback inspects the authoritative entity state and reports
 * whether the mutation that was attempted under this token already took effect.
 *
 * Return `{ alreadyApplied: true, result }` to short-circuit (token is marked
 * Completed); return `{ alreadyApplied: false }` to allow a genuine retry.
 */
export type ReconcileFn = () => Promise<
  | { alreadyApplied: true; result: { success: boolean; auditWarning?: string } }
  | { alreadyApplied: false }
>;

/**
 * Reserve a request token before performing the mutation.
 *
 * - If the token does not exist → creates a Pending row and returns { reserved }.
 * - If the token exists and is Completed → returns { alreadyCompleted, result }.
 * - If the token exists and is Pending but stale (>30 s) → reconciles entity
 *   state via the supplied `reconcile` callback. If the mutation already
 *   occurred, marks Completed and returns success. Otherwise re-reserves.
 * - If the token exists and is Pending and fresh → rejects (concurrent request).
 * - If the token exists and is Failed → reconciles first; if mutation already
 *   occurred marks Completed, otherwise re-reserves for retry.
 *
 * FAIL-CLOSED: any database error throws and the endpoint must not proceed.
 */
export async function reserveToken(params: {
  requestToken: string;
  entityId: string;
  action: string;
  performedBy: string;
  /** Called for stale-Pending and Failed tokens to check if the mutation already took effect. */
  reconcile?: ReconcileFn;
}): Promise<ReserveResult> {
  const { requestToken, entityId, action, performedBy, reconcile } = params;

  // 1. Look up existing token — fail closed on DB error
  const existing = await IdempotencyTokens.findOne({
    filters: { token: requestToken },
  });

  if (existing) {
    // ── Completed → return stored result (idempotent replay) ──
    if (existing.status === 'Completed') {
      let parsed: { success: boolean; auditWarning?: string } = { success: true };
      if (existing.result) {
        try { parsed = JSON.parse(existing.result); } catch { /* use default */ }
      }
      return { alreadyCompleted: true, result: parsed };
    }

    // ── Failed → reconcile then decide ──
    if (existing.status === 'Failed') {
      if (reconcile) {
        const r = await reconcile();
        if (r.alreadyApplied) {
          // Mutation succeeded despite the token being marked Failed
          await IdempotencyTokens.update({
            id: existing.id,
            record: { status: 'Completed', result: JSON.stringify(r.result) },
          });
          return { alreadyCompleted: true, result: r.result };
        }
      }
      // Mutation genuinely did not occur — re-reserve for retry
      await IdempotencyTokens.update({
        id: existing.id,
        record: { status: 'Pending', entityId, action, performedBy, result: '' },
      });
      return { reserved: true, tokenRecordId: existing.id };
    }

    // ── Pending ──
    const createdMs = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
    const ageMs = Date.now() - createdMs;

    if (ageMs < STALE_THRESHOLD_MS) {
      // Fresh Pending → another request is in progress, reject concurrent
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'This request is already being processed. Please wait and retry.',
      });
    }

    // Stale Pending → reconcile before deciding
    if (reconcile) {
      const r = await reconcile();
      if (r.alreadyApplied) {
        // The mutation actually succeeded but completeToken failed — mark Completed
        await IdempotencyTokens.update({
          id: existing.id,
          record: { status: 'Completed', result: JSON.stringify(r.result) },
        });
        return { alreadyCompleted: true, result: r.result };
      }
    }

    // Mutation did not occur — re-reserve for genuine retry
    await IdempotencyTokens.update({
      id: existing.id,
      record: { status: 'Pending', entityId, action, performedBy, result: '' },
    });
    return { reserved: true, tokenRecordId: existing.id };
  }

  // 2. No existing token → create a new Pending reservation
  const created = await IdempotencyTokens.create({
    record: { token: requestToken, entityId, action, performedBy, status: 'Pending' },
  });

  // 3. Race-check: verify no duplicate was created concurrently
  const dupes = await IdempotencyTokens.findAll({
    filters: { token: requestToken },
    limit: 5,
    fields: ['id', 'status', 'createdAt'],
  });

  if (dupes.records.length > 1) {
    const sorted = [...dupes.records].sort((a, b) => {
      const ta = a.createdAt ?? '';
      const tb = b.createdAt ?? '';
      return ta < tb ? -1 : ta > tb ? 1 : a.id.localeCompare(b.id);
    });
    const keeper = sorted[0];
    if (keeper.id !== created.id) {
      await IdempotencyTokens.delete({ id: created.id });
      if (keeper.status === 'Completed') {
        const full = await IdempotencyTokens.findOne({ id: keeper.id });
        let parsed: { success: boolean; auditWarning?: string } = { success: true };
        if (full?.result) {
          try { parsed = JSON.parse(full.result); } catch { /* default */ }
        }
        return { alreadyCompleted: true, result: parsed };
      }
      throw new ZiteError({
        code: 'CONFLICT',
        message: 'This request is already being processed. Please wait and retry.',
      });
    }
    for (const d of sorted.slice(1)) {
      try { await IdempotencyTokens.delete({ id: d.id }); } catch { /* best-effort */ }
    }
  }

  return { reserved: true, tokenRecordId: created.id };
}

/**
 * Mark the token as Completed and store the result. Call after mutation succeeds.
 */
export async function completeToken(
  tokenRecordId: string,
  result: { success: boolean; auditWarning?: string },
): Promise<void> {
  try {
    await IdempotencyTokens.update({
      id: tokenRecordId,
      record: { status: 'Completed', result: JSON.stringify(result) },
    });
  } catch (e) {
    // Best-effort — the mutation already succeeded. A retry will now hit
    // the stale-Pending path which reconciles entity state, so a duplicate
    // mutation is prevented even if this update fails.
    console.error('[idempotency] Failed to mark token completed:', e);
  }
}

/**
 * Mark the token as Failed so the caller can retry with the same token.
 */
export async function failToken(tokenRecordId: string): Promise<void> {
  try {
    await IdempotencyTokens.update({
      id: tokenRecordId,
      record: { status: 'Failed' },
    });
  } catch (e) {
    console.error('[idempotency] Failed to mark token failed:', e);
  }
}

/**
 * Merge requestToken into audit metadata so audits remain searchable.
 */
export function withRequestToken(
  metadata: Record<string, unknown> | undefined,
  requestToken: string | undefined,
): Record<string, unknown> | undefined {
  if (!requestToken) return metadata;
  return { ...(metadata ?? {}), requestToken };
}
