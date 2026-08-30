import { useState, useRef, useCallback, useEffect } from 'react';
import { errMsg } from './errorMessage';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * ACHU-096/107/108/109/110/111/113/118/119: Shared request-management hook.
 *
 * - Bounded timeout (default 30 s, configurable)
 * - Request sequence IDs — latest-request-wins
 * - Stale-response rejection (outdated responses never update state)
 * - Cached-data preservation on failure (previous data kept, marked stale)
 * - Visible loading / error / stale state
 * - Retry (re-fires last request)
 * - Safe component-unmount handling
 * - Independent per-instance — no global blocking
 * - No loadingRef guard — new requests always accepted, superseding older ones
 * - 🆕 §37 (Sesiunea 154) — `updatedAt`: CÂND a venit ultimul răspuns REUȘIT
 *
 * 🔴 **`updatedAt` se scrie doar pe reușită, lângă `setData`**, și asta e chiar rostul lui. La
 * eșec datele se PĂSTREAZĂ și se marchează `stale` (rândul de mai sus), deci ecranul arată cifre
 * vechi — iar întrebarea omului atunci e „vechi de cât?". ⛔ Mutat la `finally`, marcajul ar fi
 * spus „acum" despre cifre de acum o oră: exact minciuna pentru care există câmpul.
 */
export function useTrackedRequest<T>(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  /** ⚠️ Momentul ultimului răspuns REUȘIT. `null` până la primul. */
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const lastFnRef = useRef<(() => Promise<T>) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fire = useCallback((fn: () => Promise<T>) => {
    lastFnRef.current = fn;
    const mySeq = ++seqRef.current;
    setLoading(true);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    });

    Promise.race([fn(), timeoutPromise])
      .then((result) => {
        if (!mountedRef.current || mySeq !== seqRef.current) return;
        setData(result);
        setError(null);
        setStale(false);
        setUpdatedAt(new Date());
      })
      .catch((e: unknown) => {
        if (!mountedRef.current || mySeq !== seqRef.current) return;
        setError(errMsg(e) || 'Request failed');
        // Data is preserved (not cleared) — mark stale
        setStale(true);
      })
      .finally(() => {
        if (!mountedRef.current || mySeq !== seqRef.current) return;
        setLoading(false);
      });
  }, [timeoutMs]);

  const retry = useCallback(() => {
    if (lastFnRef.current) fire(lastFnRef.current);
  }, [fire]);

  return { data, loading, error, stale, updatedAt, fire, retry, setData };
}

/** Simple timeout wrapper for one-off promises (e.g. pagination). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms),
    ),
  ]);
}

