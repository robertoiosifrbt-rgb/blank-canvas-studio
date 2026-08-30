import { useCallback, useSyncExternalStore } from 'react';

/**
 * ACHU-501 (Sesiunea 108) — "is this a phone-width window right now?"
 *
 * In its own file rather than beside its first caller: a hook exported from a
 * component file breaks Fast Refresh (`react-refresh/only-export-components`), and
 * the second caller is already foreseeable — anything that has to sit somewhere
 * else on a narrow screen has the same question.
 *
 * ⚠️ **A media query, not a user-agent sniff.** What matters is how wide the window
 * is, not what the device claims to be: a desktop browser dragged narrow behaves
 * exactly like a phone here, and a tablet in landscape does not.
 *
 * ⚠️ **`useSyncExternalStore`, not `useState` + `useEffect`.** The window's width is
 * an external store — React does not own it. Subscribing with an effect means the
 * first paint uses one value and then corrects itself, which is a cascading render
 * and is what `react-hooks/set-state-in-effect` warns about. This reads the live
 * value at render time, so there is nothing to correct.
 *
 * The `matchMedia` guards are for the test environment and any renderer without a
 * window: absent, the answer is "not narrow", which is the desktop default and the
 * safe one — it never MOVES anything that was working.
 */
const NARROW = '(max-width: 639px)';

export function useIsNarrow(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mq = window.matchMedia(NARROW);
    // Stays live rather than being read once at mount: rotating a phone is the
    // common case, not the exotic one.
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const read = useCallback(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(NARROW).matches
        : false,
    [],
  );

  return useSyncExternalStore(subscribe, read, () => false);
}

