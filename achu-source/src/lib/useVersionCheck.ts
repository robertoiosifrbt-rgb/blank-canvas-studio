import { useEffect, useState } from 'react';

/**
 * ACHU-265 — ACHU-249 only catches the LOUD half of a stale client: a tab
 * that requests a chunk the old bundle references and the new deployment no
 * longer has, which throws and is caught by `isStaleBundleError`
 * (ErrorBoundary.tsx). The quiet half was untreated: a tab left open across
 * a promotion keeps rendering already-loaded code — including the nav menu
 * — with no error and no signal, for as long as nobody clicks something
 * that needs a chunk the old bundle never loaded.
 *
 * The check: `index.html` names the current build's hashed script path
 * (`scripts/serve-frontend.mjs` always revalidates it, never caches it
 * long). Capture the path this tab was actually loaded with, then compare
 * it to whatever `index.html` names now — a mismatch means a newer build
 * exists, whether or not this tab has hit a missing chunk yet.
 */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

function currentScriptSrc(): string | null {
  return document.querySelector('script[type="module"]')?.getAttribute('src') ?? null;
}

export function useVersionCheck(): { stale: boolean } {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const loadedSrc = currentScriptSrc();
    // Nothing to compare against — e.g. the dev server serves an
    // unhashed source path, not a built bundle.
    if (!loadedSrc) return;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/index.html', { cache: 'no-store' });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
        if (match && match[1] && match[1] !== loadedSrc) setStale(true);
      } catch {
        // A network hiccup says nothing about whether a new version exists —
        // stay quiet rather than raise a false alarm.
      }
    };

    const t = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, []);

  return { stale };
}

