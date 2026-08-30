import { useCallback, useEffect, useState } from 'react';
import {
  getPayrollDeductions, addPayrollDeduction, removePayrollDeduction, getDeductionTypes,
  type PayrollDeductionTypesResponse, type PayrollDeductionType, type PayrollDeductionsResponse,
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
 * ACHU-331 (Sesiunea 80l) — money coming OFF a wage.
 *
 * ⚠️ Deliberately its own box, below the bonus one and looking different. The two
 * are not variants of each other: this one takes money away, and it is unlawful
 * without a stated authority. A shared control with a +/− toggle would make the
 * most consequential field on the form — what allows this — look optional.
 */
export function DeductionsSection({ cleanerId, personName }: { cleanerId: string; personName: string }) {
  const [data, setData] = useState<PayrollDeductionsResponse | null>(null);
  const [meta, setMeta] = useState<PayrollDeductionTypesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [authority, setAuthority] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getPayrollDeductions(cleanerId).then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, [cleanerId]);

  useEffect(() => {
    load();
    getDeductionTypes().then(r => {
      setMeta(r);
      // Preselected only when there is genuinely one choice. Authority is NEVER
      // preselected — see below.
      if (r.types?.length === 1) setType(r.types[0].code);
    }).catch(() => setMeta(null));
  }, [load]);

  async function add() {
    const value = Number(amount);
    if (!type) { toast.error('Choose what the deduction is for.'); return; }
    if (!Number.isFinite(value) || value === 0) { toast.error('Enter an amount.'); return; }
    if (!authority) { toast.error('Say what makes this deduction lawful.'); return; }
    setBusy(true);
    try {
      await addPayrollDeduction(cleanerId, { type, amount: value, authority, note: note.trim() || null });
      toast.success(`£${value.toFixed(2)} deduction added for ${personName}.`);
      setAmount(''); setNote(''); setAuthority('');
      load();
    } catch (e) {
      // The server's sentence. It is the one that explains the tribunal risk, and
      // why a court order is not a plain amount.
      toast.error(errMsg(e) ?? 'Could not add.');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await removePayrollDeduction(id);
      toast.success('Removed.');
      load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not remove.');
    }
  }

  const types: PayrollDeductionType[] = meta?.types ?? [];
  if (types.length === 0) return null;

  const waiting = data?.waiting ?? [];
  const taken = data?.taken ?? [];

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs font-medium">Deductions from wages</p>
      {/* ⚠️ The three field labels below are deliberately longer than the bonus
          box's wording. Both boxes live in the SAME dialog, and "Amount to
          deduct" is worded so it does not even CONTAIN the bonus box's label —
          and identical labels there are ambiguous to a screen reader and to
          anybody reading the form aloud — one of them adds money and the other
          takes it. Caught by a test that suddenly matched two elements. */}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {waiting.length > 0 && (
        <div className="space-y-1">
          {waiting.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <span className="font-medium">−{fmt(d.amount)}</span>
              <span className="text-muted-foreground truncate">{d.label}</span>
              <Badge variant="outline" className="ml-auto shrink-0">Waiting</Badge>
              <Button
                type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                aria-label={`Remove deduction of ${fmt(d.amount)}`} title={`Remove deduction of ${fmt(d.amount)}`}
                onClick={() => remove(d.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            Taken off the next payroll run for this person, after tax.
          </p>
        </div>
      )}

      {taken.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          {taken.slice(0, 5).map(d => (
            <div key={d.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>−{fmt(d.amount)}</span>
              <span className="truncate">{d.label}</span>
              {/* No remove button, and not a disabled one: the wage was paid net
                  of this, and the record is the evidence it was authorised. */}
              <Badge variant="secondary" className="ml-auto shrink-0">Taken</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-[2]">
            <Label htmlFor="dd-type" className="text-xs">What the deduction is for</Label>
            <select
              id="dd-type"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="">Choose…</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <Label htmlFor="dd-amount" className="text-xs">Amount to deduct (£)</Label>
            <Input
              id="dd-amount" type="number" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="dd-authority" className="text-xs">What makes this lawful</Label>
          <select
            id="dd-authority"
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={authority}
            onChange={e => setAuthority(e.target.value)}
          >
            {/*
              ⚠️ No preselected option, on purpose. Any default here would be a
              guess about a legal question, recorded as an answer — and this is
              the field a tribunal asks about.
            */}
            <option value="">Choose…</option>
            {(meta?.authorities ?? []).map(a => (
              <option key={a.code} value={a.code}>{a.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            A deduction with none of these can be reclaimed in full at a tribunal — including any part that
            was genuinely owed.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="dd-note" className="text-xs">Deduction note</Label>
            <Input id="dd-note" value={note} onChange={e => setNote(e.target.value)} placeholder="April overpayment" />
          </div>
          <Button type="button" variant="outline" onClick={add} disabled={busy} aria-label="Add deduction" title="Add deduction">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {meta?.runningBalanceNote && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          {/* The gap, said on the screen rather than left in a file: if somebody
              stops entering instalments, nothing chases what is left. */}
          ⚠️ {meta.runningBalanceNote}
        </p>
      )}
    </div>
  );
}

