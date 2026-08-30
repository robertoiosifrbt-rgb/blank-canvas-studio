/**
 * ACHU-513 (Sesiunea 110) — "Confirm access", `docs/Backlog_Client_Prioritar.md` Nivel 1.
 *
 * The customer says, about ONE visit: the cleaner will be able to get in.
 *
 * ⚠️ Why this is not the "Getting in" card (ACHU-239) with a button on it. That card holds a
 * standing instruction — the gate code, where the key lives — and it changes about once a
 * year. It cannot answer the question the office has on the morning of a visit: did anybody
 * actually leave the key out THIS time. So this is per-visit, and it carries a date.
 *
 * ⛔ The copy never claims more than happened. "Confirmed" means the customer said so; it is
 * not a promise from ACHU, and it does not change the visit. And an unconfirmed visit is
 * NOT presented as a problem — most visits will never be confirmed, and a screen that
 * nags on every card teaches people to ignore it.
 *
 * ✅ Withdrawal is offered as plainly as confirmation. A confirmation you cannot take back
 * is worse than none: it would send a cleaner to a locked door with a note saying access
 * was arranged. That is why the second button is not hidden behind anything.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, DoorOpen, Loader2 } from 'lucide-react';
import { confirmJobAccess } from '@/lib/endpoints';
import { fmtDate } from '@/lib/format';
import { toast } from 'sonner';

export default function AccessConfirmation({ jobId, confirmedAt, onChanged }: {
  jobId: string;
  confirmedAt?: string | null;
  onChanged?: (confirmedAt: string | null) => void;
}) {
  const [stored, setStored] = useState<string | null>(confirmedAt ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Adjusting state when a prop changes, during render — the React-documented pattern
  // already used in `PropertyInfoEditDialog.tsx`, rather than an effect that would run a
  // render later. It matters here because the parent refetches the portal after other
  // actions, and a stale local copy would show "not confirmed" over a confirmed visit.
  const [seen, setSeen] = useState(confirmedAt ?? null);
  if ((confirmedAt ?? null) !== seen) {
    setSeen(confirmedAt ?? null);
    setStored(confirmedAt ?? null);
  }

  const send = async (confirmed: boolean) => {
    setSaving(true);
    setError('');
    try {
      const res = await confirmJobAccess({ jobId, confirmed });
      setStored(res.accessConfirmedAt ?? null);
      onChanged?.(res.accessConfirmedAt ?? null);
      toast.success(confirmed
        ? 'Thank you — we have told the office access is arranged.'
        : 'Taken back. We have told the office access is no longer confirmed.');
    } catch (e) {
      // The message from the server is shown as-is when there is one: it says the useful
      // thing ("this visit is closed"), which a generic sentence would hide.
      setError(e instanceof Error ? e.message : 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (stored) {
    return (
      <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5">
        <p className="text-xs flex items-start gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
          <span>
            <span className="font-medium">You confirmed access</span> on {fmtDate(stored)}. The office and
            your cleaner can see this.
          </span>
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button variant="outline" size="sm" className="text-xs" onClick={() => send(false)} disabled={saving}>
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</> : 'Plans changed — take this back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-2.5 space-y-1.5">
      <p className="text-xs text-muted-foreground">
        If you have arranged how your cleaner gets in for this job — you will be home, the key is
        out, the gate is unlocked — you can tell us here. It saves a phone call on the day.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button variant="outline" size="sm" className="text-xs" onClick={() => send(true)} disabled={saving}>
        {saving
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</>
          : <><DoorOpen className="h-3.5 w-3.5 mr-1.5" />Confirm access is ready</>}
      </Button>
    </div>
  );
}

