import { useCallback, useEffect, useState } from 'react';
import {
  getRecurringPayments, addRecurringPayment, stopRecurringPayment, getEarningTypes,
  type PayrollEarningType, type PayrollRecurringResponse, type PayrollRecurringPayment,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── Standing amounts that repeat every pay period (ACHU-386, Sesiunea 88) ───
 *
 * 🔴 READ THIS BEFORE CHANGING THE PANEL. The owner refused automatic `Bonus Rules` on
 * 04/08/2026 because a rule pays the wrong amount silently at EVERY run, with a payslip
 * that adds up perfectly. A recurring payment carries the same hazard.
 *
 * What makes it acceptable is two things, and this component owns one of them: **the
 * warning is shown before the amount is saved, in the server's words.** The other is that
 * every run says which lines came from a rule before approval.
 *
 * ⛔ If standing amounts are ever withdrawn, delete the feature — do not keep it and
 * remove the warning.
 *
 * ⚠️ Running and stopped are two LISTS, not one list with a badge. "Is this still being
 * paid" is the question, and a flag in a mixed list is the answer somebody misreads on
 * the screen where misreading costs money every month.
 */
export function RecurringSection({ cleanerId, personName }: { cleanerId: string; personName: string }) {
  const [data, setData] = useState<PayrollRecurringResponse | null>(null);
  const [types, setTypes] = useState<PayrollEarningType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getRecurringPayments(cleanerId).then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, [cleanerId]);

  useEffect(() => {
    load();
    getEarningTypes().then(r => setTypes(r.types)).catch(() => setTypes([]));
  }, [load]);

  const only = types[0];

  async function add() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) { toast.error('Enter an amount.'); return; }
    if (!startDate) { toast.error('Choose the date it starts from.'); return; }
    setBusy(true);
    try {
      await addRecurringPayment(cleanerId, {
        type: only.code, amount: value, note: note.trim() || null, startDate, endDate: null,
      });
      toast.success(`${only.label} of £${value.toFixed(2)} every period added for ${personName}.`);
      setAmount(''); setNote(''); setStartDate('');
      load();
    } catch (e) {
      // The server's sentence — it names the typo guard and why a negative is refused.
      toast.error(errMsg(e) ?? 'Could not add.');
    } finally { setBusy(false); }
  }

  async function stop(id: string) {
    setBusy(true);
    try {
      const res = await stopRecurringPayment(id);
      // ⚠️ The server's notice, not a cheerful "Stopped": it says a draft payroll that
      // already includes the amount needs recalculating, which is the next thing to do.
      toast.success(res.notice ?? 'Stopped.');
      load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not stop it.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded border p-3 space-y-3">
      <p className="text-sm font-medium">Amounts that repeat every period</p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 🔴 BEFORE the form, and rendered verbatim. This is the sentence that makes the
          feature different from the automatic rules the owner refused. */}
      {data?.notice && (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{data.notice}</span>
        </p>
      )}

      {data?.running?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Being paid every period</p>
          {data.running.map((r: PayrollRecurringPayment) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
              <span className="font-medium">{r.label} £{r.amount.toFixed(2)}</span>
              <span className="text-muted-foreground">from {r.startDate}</span>
              {r.note && <span className="text-muted-foreground">· {r.note}</span>}
              <Button variant="outline" size="sm" className="ml-auto" disabled={busy}
                onClick={() => stop(r.id)}>
                Stop
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ⚠️ Kept visible, not hidden once stopped. "Why did Maria stop getting £30 in
          August" is a question somebody asks, and a hidden row cannot answer it. */}
      {data?.stopped?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Stopped</p>
          {data.stopped.map((r: PayrollRecurringPayment) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              {r.label} £{r.amount.toFixed(2)} · stopped {r.stoppedAt?.slice(0, 10)}
              {r.stoppedBy && <> by {r.stoppedBy}</>}
            </p>
          ))}
        </div>
      )}

      {data && data.running?.length === 0 && data.stopped?.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing repeats for {personName}.</p>
      )}

      {only && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`rec-amount-${cleanerId}`} className="text-xs">{only.label} each period (£)</Label>
            <Input id={`rec-amount-${cleanerId}`} inputMode="decimal" className="w-28"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rec-start-${cleanerId}`} className="text-xs">Starts from</Label>
            <DateField id={`rec-start-${cleanerId}`} className="w-40"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1 grow">
            <Label htmlFor={`rec-note-${cleanerId}`} className="text-xs">What is it for</Label>
            <Input id={`rec-note-${cleanerId}`} value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. travel allowance" />
          </div>
          <Button size="sm" disabled={busy} onClick={add}>Add</Button>
        </div>
      )}
    </div>
  );
}

