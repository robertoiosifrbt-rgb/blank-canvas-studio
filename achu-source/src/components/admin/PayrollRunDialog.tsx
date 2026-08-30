import { useEffect, useState } from 'react';
import {
  getPayrollRun,
  recalculatePayrollRun, approvePayrollRun, lockPayrollRun,
  reopenPayrollRun, deletePayrollRun,
  type PayrollRunDetail, type PayrollRunLine,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Lock, RotateCcw, Trash2, CheckCircle2, RefreshCw, FileDown } from 'lucide-react';
import { generatePayslipPdf } from '@/lib/payslipPdf';
import { toast } from 'sonner';
import { FREQUENCIES, money } from '@/lib/payrollRunsFormat';
import { StatusBadge } from './PayrollRunStatusBadge';
import { RtiPanel } from './PayrollRunRtiPanel';
import { VersionsPanel } from './PayrollRunVersionsPanel';
import { NiCorrectionPanel } from './PayrollRunNiCorrectionPanel';
import { errMsg } from '@/lib/errorMessage';

export function RunDialog({ id, onClose, onChanged, onDeleted }: {
  id: string; onClose: () => void; onChanged: () => void; onDeleted: () => void;
}) {
  const [d, setD] = useState<PayrollRunDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');

  async function load() {
    try { setD(await getPayrollRun(id)); }
    catch (e) { toast.error(errMsg(e) ?? 'Could not load that payroll.'); }
  }
  useEffect(() => { load(); }, [id]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      onChanged();
    } catch (e) {
      // Approval refusals arrive as a multi-line list of who is affected and
      // why. Shown as-is: shortening it would drop the names.
      toast.error(errMsg(e) ?? 'That did not work.');
    } finally { setBusy(false); }
  }

  if (!d) {
    return (
      <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent><p className="text-sm text-muted-foreground">Loading…</p></DialogContent>
      </Dialog>
    );
  }

  const { run, totals, lines, exceptions, can, missing, employer, pendingBankDetailWarning, approval } = d;

  /**
   * One person's payslip. Built from the STORED line, not recalculated — that is
   * the whole reason the line snapshots results, so a payslip reprinted in two
   * years says what it said on the day.
   */
  async function payslip(l: PayrollRunLine) {
    await generatePayslipPdf({
      employer: employer ?? {},
      employeeName: l.name,
      // ACHU-382. The same number the office sees in the list and HMRC receives as the
      // Payroll ID. Absent on an old reprint is fine — the generator prints the name alone.
      employeeNumber: l.employeeNumber ?? null,
      taxCode: l.taxCode,
      niCategory: l.niCategory,
      taxYear: run.taxYear,
      frequency: run.frequency,
      periodNumber: run.periodNumber,
      payDate: run.payDate,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      version: run.version,
      runStatus: run.status,
      gross: l.gross,
      incomeTax: l.incomeTax,
      nationalInsurance: l.nationalInsurance,
      pension: l.pension,
      studentLoan: l.studentLoan,
      postgraduateLoan: l.postgraduateLoan_,
      netPay: l.netPay,
      grossToDate: l.grossToDate,
      taxToDate: l.taxToDate,
      hoursWorked: l.hoursWorked,
      deductionLines: l.deductionLines,
      /**
       * ACHU-333. Passed from the STORED line, like everything else here — a
       * payslip reprinted in two years has to say what it said on the day.
       *
       * 🔴 `postTaxDeductions` is required by ERA 1996 s.8, which wants the
       * amount and the purpose of each variable deduction. It was missing for as
       * long as deductions existed, which was a few hours.
       */
      basicPay: l.basicPay,
      // ACHU-338. The frozen figure, as at the period end — not recomputed here.
      holidayRemainingHours: l.holidayRemainingHours,
      earnings: l.earnings,
      postTaxDeductions: l.postTaxDeductions,
      warnings: l.warnings,
    });
  }
  const errors = (exceptions ?? []).filter(e => e.severity === 'error');
  const warnings = (exceptions ?? []).filter(e => e.severity === 'warning');

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {FREQUENCIES.find(f => f.value === run.frequency)?.label ?? run.frequency} — period {run.periodNumber}
            <StatusBadge status={run.status} version={run.version} />
          </DialogTitle>
          <DialogDescription>
            {run.taxYear} · {run.periodStart} to {run.periodEnd} · paid {run.payDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* ── Who agreed what, and when ─────────────────────────────── */}
          {(run.approvedBy || run.lockedBy || run.reopenedBy) && (
            <div className="rounded border p-2 text-xs text-muted-foreground space-y-0.5">
              {run.approvedBy && <div>Approved by {run.approvedBy}</div>}
              {run.lockedBy && <div>Locked by {run.lockedBy} — the money has been paid</div>}
              {run.reopenedBy && (
                <div className="text-amber-700 dark:text-amber-500">
                  Reopened by {run.reopenedBy} — “{run.reopenReason}”
                </div>
              )}
            </div>
          )}

          {/* ── Errors first. They block approval at the server, so the screen
                 has to say WHY the button will not work. ─────────────────── */}
          {errors.length > 0 && (
            <div className="rounded border border-destructive bg-destructive/10 p-3 space-y-1">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                This payroll cannot be approved as it stands
              </p>
              <ul className="list-disc pl-5 text-sm">
                {errors.map((e, i) => (
                  <li key={i}>{e.cleanerName && <strong>{e.cleanerName}: </strong>}{e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Who is NOT in this run ────────────────────────────────
                 A list of people who will not be paid. Hidden, it is a silent
                 underpayment — which is why it sits above the totals rather
                 than under them. */}
          {(missing ?? []).length > 0 && (
            <div className="rounded border border-destructive bg-destructive/10 p-3 space-y-1">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {missing.length === 1 ? 'One person is' : `${missing.length} people are`} NOT in this payroll
              </p>
              <p className="text-sm">{missing.join(', ')}</p>
              <p className="text-xs">
                They have pay details and should be in this period, but could not be calculated — usually a tax
                code the app refuses to guess at, or an employment status it will not run through payroll
                (a director, or somebody recorded as self-employed). Fix the detail under
                <strong> Setup → Employee Pay Details</strong>, then recalculate.
              </p>
            </div>
          )}

          {/* ── ACHU-377: somebody in this run asked to change where their wage goes ──
                 Above the generic warnings, and deliberately so. It is not "worth a
                 look": an approved change applies to THIS period, so deciding it after
                 the run is paid means the money went to the old account and cannot be
                 pulled back from here.

                 🔴 The server's sentence, verbatim — it names the people, says to decide
                 before payment, and says it does not block the run. A screen that
                 shortened it would drop one of those three, and the third is the one
                 that stops the office learning to clear requests unread in order to run
                 payroll.

                 ⛔ It WARNS and does not block, by design: blocking everybody's wages
                 over one person's form is how a check becomes a rubber stamp. */}
          {pendingBankDetailWarning && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-1 dark:border-amber-800 dark:bg-amber-950">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                A bank detail change is waiting for a decision
              </p>
              <p className="text-sm">{pendingBankDetailWarning}</p>
              <p className="text-xs text-muted-foreground">
                Decide it under <strong>Setup → Employee Pay Details</strong>, at the top of the screen.
              </p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-1 dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium">Worth a look before approving</p>
              <ul className="list-disc pl-5 text-sm">
                {warnings.map((e, i) => (
                  <li key={i}>{e.cleanerName && <strong>{e.cleanerName}: </strong>}{e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Totals ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['People', String(totals.people)],
              ['Gross', money(totals.gross)],
              ['Net pay', money(totals.netPay)],
              ['Total cost', money(totals.totalEmployerCost)],
            ].map(([label, value]) => (
              <div key={label} className="rounded border p-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {/* Named because it is the figure owners underestimate, and because
                "net pay" is what people assume payroll costs. */}
            Total cost is what leaves the company: gross plus employer National Insurance and the employer's
            pension share.
            {/* 🔴 ACHU-497. This sentence used to end "It is always more than the wages
                themselves." Roberto's screenshot showed Total cost £0.00 beside Net pay
                £404.75, so the claim was visibly false on the screen making it — a PAYE
                refund pays out money that no gross produced, and employer cost is built
                from gross. Stated conditionally rather than deleted: in the ordinary case
                it is the point of the tile, and it is the figure owners underestimate. */}
            {totals.totalEmployerCost >= totals.netPay
              ? ' It is always more than the wages themselves.'
              : ''}
          </p>
          {totals.totalEmployerCost < totals.netPay && (
            <p className="text-xs rounded border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950">
              ⚠️ <strong>Total cost is lower than net pay this period, and that is not an error.</strong> Somebody is
              receiving a PAYE refund: money goes out to them without any gross to produce it, and the company gets
              it back by paying HMRC less. So the cash leaving this week is higher than the figure above —
              <strong> check the payment run against net pay, not against total cost.</strong>
            </p>
          )}

          <RtiPanel runId={run.id} />

          <NiCorrectionPanel runId={run.id} />

          {/* ACHU-372. ⚠️ Rendered only for a run that has been corrected at least
              once. On a run at version 1 there is nothing to show and a permanent
              "no history" button would be one more thing to read on the screen where
              the two lists that MUST be read are the errors and who is missing. */}
          {run.version > 1 && <VersionsPanel runId={run.id} />}

          {/* ── The people ───────────────────────────────────────────── */}
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-2">Name</th>
                  <th scope="col" className="py-1 pr-2">Code</th>
                  <th scope="col" className="py-1 pr-2 text-right">Gross</th>
                  <th scope="col" className="py-1 pr-2 text-right">Tax</th>
                  <th scope="col" className="py-1 pr-2 text-right">NI</th>
                  <th scope="col" className="py-1 pr-2 text-right">Pension</th>
                  <th scope="col" className="py-1 pr-2 text-right">Loans</th>
                  <th scope="col" className="py-1 pr-2 text-right">Net</th>
                  <th scope="col" className="py-1" />
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      {l.name}
                      {l.hoursWorked != null && (
                        <span className="ml-1 text-xs text-muted-foreground">({l.hoursWorked}h)</span>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-xs text-muted-foreground">{l.taxCode}</td>
                    <td className="py-1 pr-2 text-right">{money(l.gross)}</td>
                    <td className="py-1 pr-2 text-right">{money(l.incomeTax)}</td>
                    <td className="py-1 pr-2 text-right">{money(l.nationalInsurance)}</td>
                    <td className="py-1 pr-2 text-right">{money(l.pension)}</td>
                    <td className="py-1 pr-2 text-right">{money(l.studentLoan + l.postgraduateLoan_)}</td>
                    <td className="py-1 pr-2 text-right font-medium">{money(l.netPay)}</td>
                    <td className="py-1 text-right">
                      <Button variant="ghost" size="sm" aria-label={`Payslip for ${l.name}`} title={`Payslip for ${l.name}`}
                        onClick={() => payslip(l)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Who built this payroll (ACHU-387) ────────────────────────
              🔴 BEFORE the Approve button, not in the response to pressing it. A warning
              that arrives with the confirmation of a decision already made is not a
              control — it is a receipt.

              ⚠️ It does NOT block, and the second sentence says so is deliberate. With one
              person holding Admin, a rule that refused self-approval would make payroll
              impossible to approve at all, and the office's only escape would be granting
              Admin to somebody who should not have it. Both sentences are the server's. */}
          {approval?.selfApproval && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-1 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm font-medium">Approving your own work</p>
              <p className="text-xs">{approval.warning}</p>
              {approval.notice && <p className="text-xs text-muted-foreground">{approval.notice}</p>}
            </div>
          )}

          {/* ── Per-person notes (ACHU-385) ──────────────────────────────
              🔴 These existed before this slice and reached only the PAYSLIP PDF. So a
              note the office needs BEFORE approving — a P45 that was ignored and why, a
              director's threshold caveat, or a salaried person whose holiday is already
              covered — was visible only to somebody who downloaded that one person's
              payslip afterwards. That is the ACHU-377 defect exactly: the capability
              existed and the screen did not.

              ⚠️ Separate from the amber box above, which carries `exceptions` — run-level
              things that BLOCK or nearly block approval. These are per-person and
              explain a figure rather than challenge it, so merging the two would either
              bury the blockers or dress the notes up as errors. */}
          {lines.some(l => l.warnings.length > 0) && (
            <div className="rounded border p-3 space-y-2">
              <p className="text-sm font-medium">Notes on individual people</p>
              {lines.filter(l => l.warnings.length > 0).map(l => (
                <div key={l.id} className="space-y-0.5">
                  <p className="text-xs font-medium">{l.name}</p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                    {l.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {reopening && (
            <div className="rounded border p-3 space-y-2">
              <Label htmlFor="pr-reason">Why is this being reopened?</Label>
              <Textarea id="pr-reason" rows={2} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g. Maria's timesheet was corrected after approval" />
              <p className="text-xs text-muted-foreground">
                {/* Not politeness. It is the only way a paid period changes. */}
                This is the only way a payroll that has been approved or paid can change, so the reason is the whole
                explanation for why a payslip no longer matches what went to the bank.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setReopening(false); setReason(''); }} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" disabled={busy}
                  onClick={() => act(() => reopenPayrollRun(id, reason), 'Reopened — now a draft again.').then(() => { setReopening(false); setReason(''); })}>
                  Reopen
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {/* Every button below is gated by the server's `can`, not by a copy of
              the state machine living here. */}
          {can.recalculate && (
            <Button variant="outline" size="sm" disabled={busy}
              onClick={() => act(() => recalculatePayrollRun(id), 'Recalculated.')}>
              <RefreshCw className="h-4 w-4 mr-1" />Recalculate
            </Button>
          )}
          {can.delete && (
            <Button variant="outline" size="sm" disabled={busy}
              onClick={() => act(() => deletePayrollRun(id), 'Draft deleted.').then(onDeleted)}>
              <Trash2 className="h-4 w-4 mr-1" />Delete draft
            </Button>
          )}
          {can.reopen && !reopening && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setReopening(true)}>
              <RotateCcw className="h-4 w-4 mr-1" />Reopen
            </Button>
          )}
          {can.approve && (
            <Button size="sm" disabled={busy || errors.length > 0}
              onClick={() => act(() => approvePayrollRun(id), 'Approved.')}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Approve
            </Button>
          )}
          {can.lock && (
            <Button size="sm" disabled={busy}
              onClick={() => act(() => lockPayrollRun(id), 'Locked — the period is closed.')}>
              <Lock className="h-4 w-4 mr-1" />Lock (paid)
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

