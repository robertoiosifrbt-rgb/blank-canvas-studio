/**
 * ACHU-401 — the `message` of a thrown value, without `any`.
 *
 * ⚠️ THIS IS A LINT SLICE, NOT A BEHAVIOUR CHANGE, and the shape below is
 * chosen to make that literally true. Every call site was `catch (e: any)` and
 * then `e?.message`, and this reproduces `e?.message` EXACTLY:
 *
 *   - a thrown `Error`      → its message
 *   - a thrown string       → `undefined` (a string primitive has no `.message`)
 *   - `null` / `undefined`  → `undefined` (optional chaining short-circuits)
 *   - an object with a
 *     non-string `message`  → that value, unchanged and uninspected
 *
 * 🔴 THE RETURN TYPE IS `string | undefined`, NOT `string`, and that is the
 * whole point of not "improving" it. Call sites write `errMsg(e) || 'fallback'`
 * or `errMsg(e) ?? 'fallback'`, and those two differ when the message is an
 * empty string. Returning a fallback from in here would silently pick one for
 * all 100-odd of them.
 *
 * ⛔ Do not add a default fallback parameter. The operator at the call site IS
 * the decision, and it was already made — this function's only job is to stop
 * the codebase asserting `any` about a value it has not looked at.
 */
export function errMsg(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return (e as { message?: string }).message;
  }
  return undefined;
}

/**
 * ACHU-401 — the `code` of a thrown value, same contract as `errMsg`.
 *
 * The backend's AppError carries a `code` ('FORBIDDEN', 'NOT_FOUND', …) beside
 * its message, and two screens branch on it. Same rule as above: reproduces
 * `e?.code` exactly and decides nothing on the caller's behalf.
 */
export function errCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

