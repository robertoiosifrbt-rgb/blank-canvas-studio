import { useEffect, useState } from 'react';
import { getP60, getP45, type P60Response, type P45Response } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
// ACHU-354. The same generators the cleaner's portal uses — one P60, one P45.
import { generateP60Pdf, generateP45Pdf } from '@/lib/statutoryFormPdf';

/**
 * ─── The P60 and the P45 (ACHU-350, Sesiunea 82) ────────────────────────────
 *
 * ⚠️ It lives INSIDE the pay-details dialog, next to the fields it depends on. Both
 * documents are blocked by missing data — an NI number, the employer PAYE
 * reference, a leaving date — and every one of those is a field on this same form.
 * On a separate screen, somebody would read "cannot issue: no NI number" and have
 * to go and find where that is typed.
 *
 * ⚠️ **A refusal is shown as a LIST, never as one error.** Four missing fields
 * discovered one at a time is how the fourth never gets filled in.
 */
export function StatutoryForms({ cleanerId }: { cleanerId: string }) {
  const [p60, setP60] = useState<P60Response | null>(null);
  const [p45, setP45] = useState<P45Response | null>(null);

  /** The years the engine holds rates for, most recent first. Same list as the reports. */
  const [taxYear, setTaxYear] = useState('2026/27');

  useEffect(() => {
    let live = true;
    // Failures are swallowed: this is a panel beside the real form, and an error
    // banner over somebody's pay details would be worse than its absence.
    getP60({ cleanerId, taxYear }).then(r => { if (live) setP60(r); }).catch(() => {});
    getP45({ cleanerId }).then(r => { if (live) setP45(r); }).catch(() => {});
    return () => { live = false; };
  }, [cleanerId, taxYear]);

  if (!p60 && !p45) return null;

  const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  return (
    <div className="rounded border p-3 space-y-3">
      <p className="text-xs font-medium">Year-end documents</p>

      {p60 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">P60</span>
            <select
              aria-label="P60 tax year"
              className="rounded border bg-background px-1 py-0.5 text-xs"
              value={taxYear}
              onChange={e => setTaxYear(e.target.value)}
            >
              {['2026/27', '2025/26'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {p60.canIssue
              ? <span className="text-xs text-muted-foreground">— ready, due by {p60.p60.dueBy}</span>
              : <span className="text-xs text-amber-700 dark:text-amber-500">— cannot be issued yet</span>}
            {/* ACHU-354. The SAME generator the cleaner's portal uses. Two would
                mean the office and the employee holding different certificates. */}
            {p60.canIssue && (
              <Button
                type="button" variant="outline" size="sm"
                aria-label={`Download P60 for ${taxYear}`}
                onClick={() => generateP60Pdf(p60.p60)}
              >
                PDF
              </Button>
            )}
          </div>

          {p60.canIssue && (
            <p className="text-xs text-muted-foreground">
              Pay {money(p60.p60.total.payPence)} · tax {money(p60.p60.total.taxPence)} · {p60.p60.periods} periods ·
              final tax code {p60.p60.finalTaxCode}
              {/* Shown separately, never folded in: the employee needs to know which
                  part came from where, and a merged figure cannot be checked. */}
              {p60.p60.previousEmployment && (
                <> · includes {money(p60.p60.previousEmployment.payPence)} from a previous employer</>
              )}
            </p>
          )}

          {!p60.canIssue && (
            <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
              {p60.blockers.map(b => <li key={b.field}>{b.why}</li>)}
            </ul>
          )}
        </div>
      )}

      {p45 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">P45</span>
            {p45.canIssue
              ? <span className="text-xs text-muted-foreground">— ready, left {p45.p45.leavingDate}</span>
              : <span className="text-xs text-muted-foreground">— not applicable, or not ready</span>}
            {p45.canIssue && (
              <Button
                type="button" variant="outline" size="sm"
                aria-label="Download P45"
                onClick={() => generateP45Pdf(p45.p45)}
              >
                PDF
              </Button>
            )}
          </div>

          {p45.canIssue && (
            <>
              <p className="text-xs text-muted-foreground">
                {/* ⚠️ ACHU-355. Box 7 is the year's total INCLUDING a previous
                    employer, and it is what the next employer continues the tax
                    calculation from. Blank — not £0.00 — on a week 1/month 1 code,
                    because a zero there would tell them to restart from nothing. */}
                {p45.p45.taxYear} · to date{' '}
                {p45.p45.totalPayToDatePence == null ? 'no entry (week 1/month 1)' : money(p45.p45.totalPayToDatePence)}
                {p45.p45.totalTaxToDatePence != null && <> pay · {money(p45.p45.totalTaxToDatePence)} tax</>}
                {' '}· tax code {p45.p45.taxCode}
                {p45.p45.studentLoanDeductions && <> · student loan deductions were being made</>}
              </p>
              {/* Box 8, shown only when it differs from box 7 — the same rule the
                  form has. Its presence is the signal that somebody worked elsewhere
                  earlier in the year. */}
              {p45.p45.payInThisEmploymentPence != null && (
                <p className="text-xs text-muted-foreground">
                  Of that, from ACHU: {money(p45.p45.payInThisEmploymentPence)} pay ·{' '}
                  {money(p45.p45.taxInThisEmploymentPence)} tax
                </p>
              )}
              {/* ⚠️ The most important sentence in this panel. Handing the employee
                  their parts feels like the job is done; HMRC has been told nothing,
                  because the submission that would tell them is not built. */}
              <p className="text-xs text-amber-700 dark:text-amber-500">{p45.p45.part1NotSent}</p>
            </>
          )}

          {!p45.canIssue && (
            <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
              {p45.blockers.map(b => <li key={b.field}>{b.why}</li>)}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {/* ⚠️ ACHU-354 changed this sentence, and it had to change. It used to say
            neither document had been given to anybody and that delivery was a
            separate step — true when the panel only showed figures, and false the
            moment the cleaner could download them. A caution that has stopped being
            true is worse than none: it tells the office to go and do by hand
            something the app now does. */}
        These are the figures each document carries. The cleaner can download both from their own portal
        (Pay tab), which is what discharges the duty to <em>give</em> them — the same PDF this button produces.
        <strong> Nothing has been sent to HMRC</strong>, and a P45 Part 1 still has to be.
      </p>
    </div>
  );
}

