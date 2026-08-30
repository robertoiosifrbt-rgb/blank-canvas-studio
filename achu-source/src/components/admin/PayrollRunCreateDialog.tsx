import { useState } from 'react';
import { createPayrollRun, type PayCalendar } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FREQUENCIES } from '@/lib/payrollRunsFormat';
import { errMsg } from '@/lib/errorMessage';

export function CreateDialog({ frequencies, payCalendar, onClose, onCreated }: {
  frequencies: string[]; payCalendar?: PayCalendar; onClose: () => void; onCreated: (id: string) => void;
}) {
  /**
   * Sesiunea 80 (ACHU-315): both fields OPEN on ACHU's own calendar instead of on a
   * blank date and a guessed frequency. The owner decided weekly, Monday to Sunday,
   * paid the following Friday (ACHU-310) — so the dialog offers exactly that, and
   * the person only overrides it for a correction.
   *
   * ⚠️ Still editable. An off-cycle run — a leaver paid mid-week, a correction — is
   * a real thing an office does, and locking the field would make the app the
   * obstacle. What changed is the DEFAULT, not the freedom.
   */
  const [frequency, setFrequency] = useState(payCalendar?.frequency ?? 'monthly');
  const [payDate, setPayDate] = useState(payCalendar?.suggested?.payDate ?? '');
  const [busy, setBusy] = useState(false);
  const followsCalendar = frequency === 'weekly' && payDate === payCalendar?.suggested?.payDate;

  async function create() {
    setBusy(true);
    try {
      const res = await createPayrollRun({ frequency: frequency as 'monthly', payDate });
      toast.success(`Draft payroll created — ${res.lines.length} people.`);
      onCreated(res.run.id);
    } catch (e) {
      // The server's own sentence. It explains which commitment is being
      // protected — "there is already a payroll for this period" carries the
      // reason with it, and rewording would lose it.
      toast.error(errMsg(e) ?? 'Could not create that payroll.');
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payroll</DialogTitle>
          <DialogDescription>
            Everybody with pay details saved will be calculated for this period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <Label htmlFor="payrollrun-paid">Paid</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="payrollrun-paid"><SelectValue /></SelectTrigger>
              <SelectContent>
                {frequencies.map(f => (
                  <SelectItem key={f} value={f}>{FREQUENCIES.find(x => x.value === f)?.label ?? f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pr-date">Pay date</Label>
            <DateField id="pr-date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              {/* The period is derived, not typed, and saying so stops somebody
                  hunting for a period field that deliberately is not here. */}
              The day the money reaches people. The tax year and the period number are worked out from it —
              a period typed by hand is one keystroke away from paying somebody for March in May.
            </p>
            {/* ACHU-315: which days of WORK this pays for, said before the run is
                created rather than discovered after. The tax week and the work week
                are different windows and only this line makes that visible. */}
            {followsCalendar && payCalendar?.describe && (
              <p className="mt-1.5 text-xs text-primary">{payCalendar.describe}</p>
            )}
            {!followsCalendar && payCalendar && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
                ⚠️ This is not ACHU's usual run ({payCalendar.workWeek}, paid {payCalendar.payDay}). Fine for a
                correction — but an ordinary weekly payroll should be the suggested Friday.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={create} disabled={busy || !payDate}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

