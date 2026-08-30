import { Button } from '@/components/ui/button';
import { Compass, RotateCw } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

/**
 * ACHU-266. Shown when no route matches the URL.
 *
 * ─── Why this file has to exist ──────────────────────────────────────────
 * React Router v6 renders `null` when nothing in `<Routes>` matches. Not an
 * error — `null`. So `ErrorBoundary` never fires, nothing reaches the error log,
 * and the person gets a COMPLETELY BLANK PAGE with no message, no action and
 * nothing to report. The app looks dead.
 *
 * That is not a hypothetical. On 31/07/2026 the owner opened
 * `/admin/payroll-people` on a client still running the previous version, where
 * that child route did not exist yet, and got exactly this blank page. Working
 * out why took reading three branches, diffing the built bundle and checking a
 * platform status page — none of which is available to the person looking at
 * the screen.
 *
 * ─── Why "Reload" is the primary button, not "Go home" ───────────────────
 * For an unknown route UNDER a portal the app itself defines, the overwhelmingly
 * likely cause is not a typo — it is that the tab is running an older version of
 * the app than the link belongs to. A full reload fetches a fresh `index.html`
 * and the route appears. `ErrorBoundary` already auto-reloads the LOUD form of
 * this (a chunk that 404s and throws, ACHU-249); this is the silent form, where
 * nothing throws and so nothing can detect it. Same cause, same cure, offered
 * rather than forced — forcing would discard a half-typed form on the way past.
 *
 * The path is printed because it is the one fact the person can read back to
 * somebody else, and a mistyped URL should be self-evident rather than a mystery.
 */
export default function NotFound({ variant = 'page' }: { variant?: 'page' | 'inline' }) {
  const location = useLocation();

  const body = (
    <div className="text-center max-w-md">
      <Compass className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">This screen does not exist here</h1>
      <p className="text-muted-foreground mb-2">
        Nothing in the app answers to this address.
      </p>
      <p className="text-muted-foreground mb-6">
        If you followed a link or a menu item, this browser tab is most likely running an older
        version of the app than the link belongs to. Reloading loads the current one.
      </p>
      <code className="block text-xs bg-muted rounded px-3 py-2 mb-6 break-all">
        {location.pathname}
      </code>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button onClick={() => window.location.reload()}>
          <RotateCw className="h-4 w-4 mr-2" />
          Reload the app
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Go to the start</Link>
        </Button>
      </div>
    </div>
  );

  // Inline keeps the surrounding layout — and therefore the menu — usable, so a
  // wrong address costs a click rather than a trip back through the front door.
  if (variant === 'inline') {
    return <div className="flex items-center justify-center py-16 px-4">{body}</div>;
  }

  return <div className="flex items-center justify-center min-h-screen bg-background p-4">{body}</div>;
}

