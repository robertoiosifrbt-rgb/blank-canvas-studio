import { useCallback, useEffect, useState } from 'react';
import {
  getPayrollMileage, addPayrollMileage, approvePayrollMileage, removePayrollMileage,
  type PayrollMileageResponse, type PayrollMileageClaim,
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
 * ─── Mileage claims (ACHU-360, backlog §17, Sesiunea 84) ────────────────────
 *
 * 🔴 The panel exists beside the bonus and deduction boxes and is deliberately NOT
 * one of them. A mileage payment at or below HMRC's approved rate is not pay: no
 * income tax, no National Insurance, no pension, and it does not count towards the
 * National Minimum Wage. Somebody filling in three boxes in one dialog has no way to
 * know which is which unless the screen says so, so it says so.
 *
 * ⚠️ **This component does NO arithmetic.** Every figure comes from the server
 * already split. There are TWO ceilings — income tax drops to 25p a mile after
 * 10,000 business miles a year while National Insurance stays at 55p — so a second
 * implementation in the browser has twice as much to get wrong as usual, and would
 * disagree with the payslip rather than with itself.
 */
export function MileageSection({ cleanerId, personName }: { cleanerId: string; personName: string }) {
  const [data, setData] = useState<PayrollMileageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [journeyOn, setJourneyOn] = useState('');
  const [miles, setMiles] = useState('');
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getPayrollMileage(cleanerId).then(setData).catch(e => setError(e?.message ?? 'Could not load.'));
  }, [cleanerId]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const m = Number(miles);
    const p = Number(rate);
    if (!journeyOn) { toast.error('Say when the journey was.'); return; }
    if (!Number.isFinite(m) || m <= 0) { toast.error('Enter the business miles.'); return; }
    /**
     * ⚠️ The rate is REQUIRED and has no default, on the screen as well as on the
     * server. HMRC's approved rate is a ceiling for tax-free payment, not a rate
     * ACHU owes — prefilling it would be the form choosing a business policy and
     * storing it as though somebody had.
     */
    if (!Number.isFinite(p) || p < 0) { toast.error('Enter what ACHU pays per mile, in pence.'); return; }
    setBusy(true);
    try {
      await addPayrollMileage(cleanerId, {
        journeyOn, miles: m, pencePerMilePaid: Math.round(p), note: note.trim() || null,
      });
      toast.success(`${m} mile(s) claimed for ${personName}.`);
      setMiles(''); setNote('');
      load();
    } catch (e) {
      // The server's own sentence — it explains why a rate is not carried forward
      // between tax years and why a motorcycle is refused.
      toast.error(errMsg(e) ?? 'Could not add.');
    } finally { setBusy(false); }
  }

  async function approve(id: string) {
    try {
      await approvePayrollMileage(id);
      toast.success('Approved. It will be paid on the next payroll run.');
      load();
    } catch (e) { toast.error(errMsg(e) ?? 'Could not approve.'); }
  }

  async function remove(id: string) {
    try {
      await removePayrollMileage(id);
      toast.success('Removed.');
      load();
    } catch (e) { toast.error(errMsg(e) ?? 'Could not remove.'); }
  }

  const waiting = data?.waiting ?? [];
  const approved = data?.approved ?? [];
  const paid = data?.paid ?? [];

  /** One row, with what the split says about it. */
  const row = (c: PayrollMileageClaim, actions: 'approve' | 'none') => (
    <div key={c.id} className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{c.split ? fmt(c.split.paidPence / 100) : '—'}</span>
        <span className="text-muted-foreground truncate">
          {c.miles} mi at {c.pencePerMilePaid}p · {c.journeyOn}
        </span>
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
              aria-label={`Remove mileage claim of ${c.miles} miles`} title={`Remove mileage claim of ${c.miles} miles`}
              onClick={() => remove(c.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="ml-auto shrink-0">{c.paid ? 'Paid' : 'Approved'}</Badge>
        )}
      </div>
      {/* ⚠️ The taxable part is named on the row rather than folded into the total.
          A claim that is partly pay looks identical to one that is not, and the
          difference lands on somebody's tax months later. */}
      {c.split?.taxableExcessPence > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-500">
          {fmt(c.split.taxableExcessPence / 100)} of this is above HMRC's approved rate, so it is taxed as pay
          {c.split.niableExcessPence === 0 && ' — but carries no National Insurance, which is correct'}.
        </p>
      )}
      {/* 🔴 The money the employee can still reclaim, and nothing else in the app
          would ever mention it. It is THEIR claim to make. */}
      {c.split?.shortfallForReliefPence != null && (
        <p className="text-xs text-muted-foreground">
          ACHU is paying {fmt(c.split.shortfallForReliefPence / 100)} less than HMRC's approved rate for this
          journey. <strong>{personName} can claim tax relief on that difference</strong> — it is their claim to
          make, not ACHU's, and nobody who is not told will make it.
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-md border p-3 space-y-3">
      <p className="text-xs font-medium">Mileage — using their own car on ACHU business</p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 🔴 Said before anything is typed, because all three boxes in this dialog
          add money and only this one adds money that is not pay. */}
      <p className="text-xs text-muted-foreground">
        <strong>This is a reimbursement, not wages.</strong> At or below HMRC's approved rate it carries no tax, no
        National Insurance and no pension — and it does <strong>not</strong> count towards the minimum wage, so an
        hourly rate has to clear the minimum on its own.
      </p>

      {waiting.length > 0 && (
        <div className="space-y-1">
          {waiting.map(c => row(c, 'approve'))}
          {/* ⚠️ Approval is its own act and the panel says why, because an
              "Approve" button with no explanation reads as a formality. */}
          <p className="text-xs text-muted-foreground pt-1">
            Nothing here is paid until it is approved — a claim is somebody's word about a journey nobody else saw.
          </p>
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          {approved.map(c => row(c, 'none'))}
          <p className="text-xs text-muted-foreground pt-1">Paid on the next payroll run for this person.</p>
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-1 pt-1 border-t">
          {paid.slice(0, 5).map(c => row(c, 'none'))}
        </div>
      )}

      {/* ⚠️ The year's running total, shown because the tax-free ceiling depends on
          it and nothing else on this screen would explain why an identical claim
          was priced differently in March than it was in May. */}
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.milesPaidThisTaxYear} business mile(s) already paid this tax year
          ({data.taxYear?.start} to {data.taxYear?.end}). The tax-free rate drops after{' '}
          {data.stepsDownAtMiles?.toLocaleString('en-GB')} miles — National Insurance does not change.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="mi-date" className="text-xs">When the journey was</Label>
            <DateField id="mi-date" value={journeyOn} onChange={e => setJourneyOn(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="mi-miles" className="text-xs">Business miles</Label>
            <Input id="mi-miles" type="number" step="0.1" value={miles} onChange={e => setMiles(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="mi-rate" className="text-xs">Pence per mile ACHU pays</Label>
            <Input id="mi-rate" type="number" step="1" value={rate} onChange={e => setRate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="mi-note" className="text-xs">Where and why (optional)</Label>
          <Input id="mi-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Between jobs, Croydon to Sutton" />
        </div>

        <Button type="button" variant="outline" size="sm" onClick={add} disabled={busy}>
          Add mileage claim
        </Button>
      </div>
    </div>
  );
}

