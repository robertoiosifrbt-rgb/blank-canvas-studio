import { useCallback, useEffect, useState } from 'react';
import {
  getPayrollEarnings, addPayrollEarning, removePayrollEarning, getEarningTypes,
  type PayrollEarningType, type PayrollEarningsResponse,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-321 (Sesiunea 80g) — amounts waiting to be paid with the next run.
 *
 * Inside the person's dialog rather than on a screen of its own: a bonus is
 * agreed about a PERSON, and the office is already looking at that person when
 * it happens.
 *
 * ⚠️ Paid entries are shown too, greyed, and cannot be removed. Hiding them
 * would make "did that bonus go out?" unanswerable from the place it was typed.
 */
export function EarningsSection({ cleanerId, personName }: { cleanerId: string; personName: string }) {
  const [data, setData] = useState<PayrollEarningsResponse | null>(null);
  const [types, setTypes] = useState<PayrollEarningType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getPayrollEarnings(cleanerId).then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, [cleanerId]);

  useEffect(() => {
    load();
    // The offered types come from the server; a list written here would
    // eventually offer something the API refuses.
    getEarningTypes().then(r => setTypes(r.types)).catch(() => setTypes([]));
  }, [load]);

  // Only one type is switched on today. When a second is, this becomes a select
  // rather than a fixed label — deliberately not built ahead of needing it.
  const only = types[0];

  async function add() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      toast.error('Enter an amount.');
      return;
    }
    setBusy(true);
    try {
      await addPayrollEarning(cleanerId, { type: only.code, amount: value, note: note.trim() || null });
      toast.success(`${only.label} of £${value.toFixed(2)} added for ${personName}.`);
      setAmount(''); setNote('');
      load();
    } catch (e) {
      // The server's sentence: it explains why a negative is a deduction and why
      // the ceiling exists.
      toast.error(errMsg(e) ?? 'Could not add.');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await removePayrollEarning(id);
      toast.success('Removed.');
      load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not remove.');
    }
  }

  if (!only) return null;

  const waiting = data?.waiting ?? [];
  const paid = data?.paid ?? [];

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs font-medium">{only.label}</p>
      <p className="text-xs text-muted-foreground">{only.hint}</p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {waiting.length > 0 && (
        <div className="space-y-1">
          {waiting.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{fmt(e.amount)}</span>
              {e.note && <span className="text-muted-foreground truncate">{e.note}</span>}
              <Badge variant="outline" className="ml-auto shrink-0">Waiting</Badge>
              <Button
                type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                aria-label={`Remove ${fmt(e.amount)}`} title={`Remove ${fmt(e.amount)}`}
                onClick={() => remove(e.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {/* Said plainly: the commonest question about a queue is when it empties. */}
            Added to the next payroll run for this person, then marked as paid.
          </p>
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          {paid.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{fmt(e.amount)}</span>
              {e.note && <span className="truncate">{e.note}</span>}
              {/* No remove button, and not a disabled one: the money has gone out
                  and the run is the record of it. */}
              <Badge variant="secondary" className="ml-auto shrink-0">Paid</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="ea-amount" className="text-xs">Amount (£)</Label>
          <Input
            id="ea-amount" type="number" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        <div className="flex-[2]">
          <Label htmlFor="ea-note" className="text-xs">What for</Label>
          <Input id="ea-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Christmas" />
        </div>
        <Button
          type="button" variant="outline" onClick={add} disabled={busy}
          aria-label={`Add ${only.label.toLowerCase()}`} title={`Add ${only.label.toLowerCase()}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

