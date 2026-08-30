import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Sesiunea 29 (backlog 46 — "Global error boundary", Tier 1).
 *
 * Until now the app had NO error boundary anywhere. Any component that threw
 * during render took the whole page down to a blank white screen — no message,
 * no way back, nothing to report. For a non-technical user running a business
 * on this, that is the worst possible failure mode: the app looks dead and the
 * only discoverable action is closing the tab.
 *
 * Two deliberate design choices:
 *
 * 1. The fallback UI uses plain markup and Tailwind classes, NOT the app's own
 *    Card/Button components. If the thing that broke IS the UI kit (or a theme
 *    token it depends on), a fallback built from that same kit can throw while
 *    rendering the error screen, which React treats as an unrecoverable double
 *    fault and turns back into a blank page. The last line of defence must not
 *    depend on the thing it is defending against.
 *
 * 2. `resetKey` lets a caller clear the error without a full reload — App.tsx
 *    passes the current pathname, so navigating elsewhere recovers by itself.
 *    Without it a single broken page would keep showing the error screen even
 *    after the user clicked something else, which reads as "the whole app is
 *    broken" rather than "that one page is".
 */
/**
 * ─── Sesiunea 52 (ACHU-249): the error a deploy causes ────────────────────
 *
 * Every route in this app is `React.lazy(() => import(...))`, and Vite gives each
 * chunk a content-hashed filename. So a deploy renames every chunk. A browser
 * that still holds the PREVIOUS `index.html` asks for a chunk name that no longer
 * exists; the static host answers unknown paths with `index.html` (the SPA
 * fallback), and the browser refuses an HTML document where it expected a module:
 *
 *     'text/html' is not a valid JavaScript MIME type.
 *
 * This bit the owner minutes after the 31/07/2026 promotion. What made it worse
 * than it looks: the app shell had already loaded, so the header and search bar
 * were on screen and the app appeared healthy — only the page underneath was
 * dead. And "Try again", the most prominent button, is the one action that CANNOT
 * work: re-rendering re-requests the same missing chunk. The user was being
 * offered a button guaranteed to fail.
 *
 * It is also not a one-off. Untreated, this happens to whoever has the app open
 * at EVERY future promotion — and both people who use it keep it open all day.
 *
 * The fix is to reload once, automatically, because a full reload fetches a fresh
 * `index.html` that points at the new chunk names. Two guards on that:
 *
 * - **A cooldown, not a one-shot flag.** If the reload does not fix it (an old
 *   `index.html` still in the HTTP cache, say), reloading again would loop
 *   forever and the user would watch a page flicker with no way out. A
 *   timestamp means the loop stops after one attempt, while a deploy that
 *   happens later in the same tab still gets its own automatic recovery — which
 *   a plain "already tried" flag would swallow.
 * - **Only for this error class.** Auto-reloading on an ordinary render bug
 *   would hide it, and a bug you cannot see is one nobody reports.
 */
const STALE_BUNDLE_PATTERNS = [
  // Chrome/Edge: the SPA fallback served HTML where a module was expected.
  /is not a valid JavaScript MIME type/i,
  // Chrome, Firefox, Safari — the same failure, worded three ways.
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  // Vite also preloads the chunk's CSS, which goes missing at the same moment.
  /unable to preload css/i,
  // Webpack's name for it. Not used here today, but free to keep.
  /chunkloaderror/i,
];

/** Exported for the tests, which pin every wording above against a real browser message. */
export function isStaleBundleError(error: Error): boolean {
  return STALE_BUNDLE_PATTERNS.some(p => p.test(`${error.name} ${error.message}`));
}

const RELOAD_MARKER = 'achu:stale-bundle-reload-at';
/** Long enough to cover a reload; short enough that a later deploy recovers by itself. */
const RELOAD_COOLDOWN_MS = 30_000;

/** sessionStorage throws in some privacy modes — a recovery path must not need it. */
function lastAutoReloadAt(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_MARKER)) || 0;
  } catch {
    return 0;
  }
}

function markAutoReload() {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
  } catch {
    /* If it cannot be recorded, the reload still happens — once, because the
       failure repeats identically and the cooldown check reads 0 either way.
       Preferring one extra reload over none is the right side to err on. */
  }
}

type Props = {
  children: ReactNode;
  /** When this value changes, the boundary clears its error and retries. */
  resetKey?: string;
  /** Shown instead of the default screen — used for in-layout failures where the nav is still usable. */
  variant?: 'page' | 'inline';
  /** Extra context for the console entry, e.g. 'admin-content'. */
  label?: string;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // Navigating away from a broken screen should recover on its own.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);

    // ACHU-249. A fresh index.html is the whole fix, so reload before anything
    // else — including before reporting, which would otherwise race the unload
    // and is pointless here: this error says "you are running yesterday's app",
    // not "the app is broken".
    if (isStaleBundleError(error) && Date.now() - lastAutoReloadAt() > RELOAD_COOLDOWN_MS) {
      markAutoReload();
      window.location.reload();
      return;
    }

    // Sesiunea 29 (backlog 46, "Error logging"): report to the server so a
    // problem can be diagnosed from the real message rather than from a
    // non-technical description of the symptom.
    //
    // Imported lazily and fired without awaiting, deliberately: this runs while
    // the app is already broken, so it must not add a second failure. Nothing
    // from the form or the record is sent — only the message, the stacks, the
    // path and which boundary caught it (see backend/src/routes/errorLog.ts).
    import('@/lib/endpoints')
      .then(({ reportClientError }) => reportClientError({
        message: error.message || String(error),
        stack: error.stack ?? null,
        componentStack: info.componentStack ?? null,
        path: typeof window !== 'undefined' ? window.location.pathname : null,
        boundary: this.props.label ?? null,
      }))
      .catch(() => { /* reporting a failure must never itself surface one */ });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const inline = this.props.variant === 'inline';
    // We only render this for a stale bundle if the automatic reload above
    // already ran and did not fix it — so the screen has to say something the
    // user can act on, not repeat an attempt that has just been made for them.
    const stale = isStaleBundleError(error);

    return (
      <div className={inline ? 'py-10' : 'min-h-screen flex items-center justify-center p-6'}>
        <div className="mx-auto max-w-md w-full rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
            {/* Inline SVG rather than the icon library, for the same reason as above. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-destructive" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h2 className="text-base font-semibold">
            {stale ? 'The app was updated while you had it open' : 'Something went wrong on this screen'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {stale
              ? 'Your data is safe — this is not a fault in your data. This browser is still running the previous version, and refreshing on its own did not clear it. Close the app or the tab completely and open it again.'
              : 'Your data is safe — nothing was saved or changed by this error. You can try again, or go back to the Dashboard.'}
          </p>

          {/* The button order changes with the cause. "Try again" only re-renders,
              which cannot recover a chunk that is no longer on the server — leaving
              it first would put the one guaranteed-useless action under the user's
              thumb, which is what happened to the owner on 31/07/2026. */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={stale
                ? 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90'
                : 'rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted order-3'}
            >
              Reload page
            </button>
            {!stale && (
              <button
                type="button"
                onClick={this.reset}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 order-1"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted order-2"
            >
              Go to Dashboard
            </button>
          </div>

          {/* Collapsed by default: useful when reporting the problem, but not
              alarming technical noise in the user's face. */}
          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Technical details (for reporting this)
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
              {error.message || String(error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

