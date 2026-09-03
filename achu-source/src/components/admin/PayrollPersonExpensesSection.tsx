import { useCallback, useEffect, useState } from 'react';
import {
  getPayrollExpenses, addPayrollExpense, approvePayrollExpense, removePayrollExpense, getExpenseTypes,
  type PayrollExpenseTypesResponse, type PayrollExpenseType,
  type PayrollExpensesResponse, type PayrollExpenseClaim,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── Expense claims (ACHU-361, backlog §17, Sesiunea 84) ────────────────────
 *
 * 🔴 The panel exists because Archana answered *"rambursăm tot ce e de rambursat"* —
 * ACHU pays back every kind of expense. What that answer did NOT settle, and could
 * not, is which of them are tax-free: that turns on what the money was for, and HMRC
 * decides it.
 *
 * So the form's centre of gravity is not the amount — it is the QUESTION. Choosing a
 * type that has one makes it appear, and the server refuses the claim until it is
 * answered. There is no default, on the screen or on the server: defaulting to yes
 * makes every claim tax-free unless somebody actively says otherwise, which is the
 * assumption that underpays PAYE; defaulting to no takes money off a reimbursement
 * that was never taxable.
 */
export function ExpensesSection({ cleanerId, personName }: { cleanerId: string; personName: string }) {
  const [data, setData] = useState<PayrollExpensesResponse | null>(null);
  const [meta, setMeta] = useState<PayrollExpenseTypesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [incurredOn, setIncurredOn] = useState('');
  const [amount, setAmount] = useState('');
  const [qualifies, setQualifies] = useState<'yes' | 'no' | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getPayrollExpenses(cleanerId).then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, [cleanerId]);

  useEffect(() => {
    load();
    getExpenseTypes().then(setMeta).catch(() => setMeta(null));
  }, [load]);

  const types: PayrollExpenseType[] = meta?.types ?? [];
  const chosen = types.find(t => t.code === type);

  async function add() {
    const value = Number(amount);
    if (!type) { toast.error('Choose what the expense was for.'); return; }
    if (!incurredOn) { toast.error('Say when it was paid for.'); return; }
    if (!Number.isFinite(value) || value <= 0) { toast.error('Enter the amount on the receipt.'); return; }
    /**
     * ⚠️ Checked here as well as on the server, and NOT because the server check is
     * unreliable. The server's refusal is the right one and carries the full
     * explanation — but a form that lets somebody press Save and then tells them
     * about a question they can still see on screen reads as a broken button.
     */
    if (chosen?.qualifyingQuestion && qualifies === '') {
      toast.error('Answer the question about this expense before saving it.');
      return;
    }
    setBusy(true);
    try {
      await addPayrollExpense(cleanerId, {
        type, incurredOn, amount: value,
        // '' never reaches the server: a type with no question sends nothing at all,
        // which is what null means in the column — "no question to answer".
        ...(chosen?.qualifyingQuestion ? { qualifies: qualifies === 'yes' } : {}),
        note: note.trim() || null,
      });
      toast.success(`£${value.toFixed(2)} expense recorded for ${personName}.`);
      setAmount(''); setNote(''); setQualifies('');
      load();
    } catch (e) {
      // The server's own sentence — it names the type's question and explains why
      // no default is safe.
      toast.error(errMsg(e) ?? 'Could not add.');
    } finally { setBusy(false); }
  }

  async function approve(id: string) {
    try {
      await approvePayrollExpense(id);
      toast.success('Approved. It will be paid on the next payroll run.');
      load();
    } catch (e) { toast.error(errMsg(e) ?? 'Could not approve.'); }
  }

  async function remove(id: string) {
    try {
      await removePayrollExpense(id);
      toast.success('Removed.');
      load();
    } catch (e) { toast.error(errMsg(e) ?? 'Could not remove.'); }
  }

  const waiting = data?.waiting ?? [];
  const approved = data?.approved ?? [];
  const paid = data?.paid ?? [];

  const row = (c: PayrollExpenseClaim, actions: 'approve' | 'none') => (
    <div key={c.id} className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{fmt(c.amount)}</span>
        <span className="text-muted-foreground truncate">{c.label} · {c.incurredOn}</span>
        {actions === 'approve' ? (
          <>
            <Button
              type="button" variant="outline" size="sm" className="ml-auto h-6 shrink-0 text-xs"
              onClick={() => approve(c.id)}
            >
              Approve
            </Button>
            <Button
              type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              aria-label={`Remove expense claim of ${fmt(c.amount)}`} title={`Remove expense claim of ${fmt(c.amount)}`}
              onClick={() => remove(c.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="ml-auto shrink-0">{c.paid ? 'Paid' : 'Approved'}</Badge>
        )}
      </div>
      {/* 🔴 A taxed reimbursement is named on its own row. It will be queried — a
          refund of something somebody paid for, arriving with tax deducted, looks
          like a mistake, and the person most likely to notice is out of pocket. */}
      {c.treatment === 'taxable' && (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          Recorded as <strong>taxable</strong> — it will be treated as pay, with tax and National Insurance.
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs font-medium">Expenses paid back</p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 🔴 The sentence the whole panel exists to carry, said before anything is
          typed rather than as an error after the fact. */}
      <p className="text-xs text-muted-foreground">
        <strong>Paying an expense back is ACHU's decision. Whether it is tax-free is not</strong> — that depends on
        what the money was for. Recording a taxable expense as tax-free does not save anything: it underpays PAYE,
        and HMRC comes to the employer.
      </p>

      {waiting.length > 0 && (
        <div className="space-y-1">
          {waiting.map(c => row(c, 'approve'))}
          <p className="text-xs text-muted-foreground pt-1">Nothing here is paid until it is approved.</p>
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          {approved.map(c => row(c, 'none'))}
          <p className="text-xs text-muted-foreground pt-1">Paid on the next payroll run for this person.</p>
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-1 pt-1 border-t">{paid.slice(0, 5).map(c => row(c, 'none'))}</div>
      )}

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-[2]">
            <Label htmlFor="ex-type" className="text-xs">What the expense was for</Label>
            {/* A native select, not a Radix one: a Radix Select opened inside a Radix
                Dialog closes the dialog in jsdom (ACHU-LIM-004), which would make the
                whole panel untestable. */}
            <select
              id="ex-type"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={type}
              onChange={e => { setType(e.target.value); setQualifies(''); }}
            >
              <option value="">Choose…</option>
              {types.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <Label htmlFor="ex-date" className="text-xs">When</Label>
            <DateField id="ex-date" value={incurredOn} onChange={e => setIncurredOn(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="ex-amount" className="text-xs">On the receipt (£)</Label>
            <Input id="ex-amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>

        {chosen?.hint && <p className="text-xs text-muted-foreground">{chosen.hint}</p>}

        {/* 🔴 The question, and the whole reason this panel is not just three boxes.
            No default option is preselected — see the component header. */}
        {chosen?.qualifyingQuestion && (
          <div className="rounded-md border border-amber-400 p-2 space-y-2">
            <p className="text-xs font-medium">{chosen.qualifyingQuestion}</p>
            <div className="flex gap-2">
              <Button
                type="button" size="sm" variant={qualifies === 'yes' ? 'default' : 'outline'}
                className="h-7 text-xs" onClick={() => setQualifies('yes')}
              >
                Yes — tax-free
              </Button>
              <Button
                type="button" size="sm" variant={qualifies === 'no' ? 'default' : 'outline'}
                className="h-7 text-xs" onClick={() => setQualifies('no')}
              >
                No — pay it back, but tax it
              </Button>
            </div>
            {/* ⛔ Shown only once "no" is chosen, so the explanation arrives when it
                is being acted on rather than as standing noise. */}
            {qualifies === 'no' && chosen.neverFor && (
              <p className="text-xs text-muted-foreground">{chosen.neverFor}</p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="ex-note" className="text-xs">What it was (optional)</Label>
          <Input id="ex-note" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <Button type="button" variant="outline" size="sm" onClick={add} disabled={busy}>
          Add expense claim
        </Button>
      </div>
    </div>
  );
}

