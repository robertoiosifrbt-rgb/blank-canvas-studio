import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Sesiunea 34 (ACHU-234, owner request: "as vrea butoane de refresh pe toate
 * paginile inclusiv chat").
 *
 * ─── Why a shared component and not a button per page ────────────────────
 * Fifteen pages each growing their own refresh control means fifteen slightly
 * different ones: different icon, different position, some spinning while
 * loading and some not. A control the user reaches for constantly has to be in
 * the same place doing the same thing every time, or they stop trusting that it
 * did anything.
 *
 * ─── It manages its own busy state ───────────────────────────────────────
 * Deliberately not driven by the page's `loading` flag. Most pages set `loading`
 * only on first mount (so the skeleton does not flash on every poll), which would
 * leave this button doing nothing visible on a click. Awaiting the handler here
 * means the spinner reflects *this* click regardless of how the page happens to
 * model loading.
 *
 * A handler that throws still clears the spinner — the page shows its own error
 * toast, and a button stuck spinning forever reads as a frozen app.
 */
export default function RefreshButton({ onRefresh, label = 'Refresh', className }: {
  onRefresh: () => void | Promise<unknown>;
  /** Accessible name. Worth overriding when a page has more than one. */
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } catch {
      // Swallowed on purpose: whatever the handler does about failure — a toast,
      // an inline error — is the page's business. This button's only job is to
      // stop spinning.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={`h-9 w-9 shrink-0 ${className ?? ''}`}
      onClick={click}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      {/* One icon, spun while busy, rather than swapping in a Loader2: swapping
          changes the button's visual weight mid-click and reads as a glitch. */}
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
    </Button>
  );
}

