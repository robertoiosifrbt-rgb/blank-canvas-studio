import { useState, useRef, useCallback, useEffect } from 'react';

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
 */
export function useTrackedRequest<T>(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
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
      })
      .catch((e: any) => {
        if (!mountedRef.current || mySeq !== seqRef.current) return;
        setError(e?.message || 'Request failed');
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

  return { data, loading, error, stale, fire, retry, setData };
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
