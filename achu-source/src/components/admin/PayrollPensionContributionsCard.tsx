import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/payrollReportFormat';
import type { PensionScheduleResponse } from '@/lib/payrollReportEndpoints';

/** ⚠️ ACHU-401 (felia 34) — forma vine din răspuns, nu dintr-o copie locală (ACHU-741). */
type PensionSchedule = PensionScheduleResponse;

/**
 * ── Pension contributions (ACHU-384) ────────────────────────────────────────
 *
 * ⚠️ Why this is on the reports page and not on a payroll run. A provider is
 * paid per PERIOD but reconciles across the year, and the schedule is a
 * year-long list — the same shape as every other export here. On a single run
 * it would answer "this month" and never "the year", which is the question a
 * provider's statement asks.
 *
 * 🔴 Every sentence is the server's. "Nothing is sent" and "there is no
 * provider yet" are claims about money leaving the company, and a component
 * that reworded one would be the version on screen while the tested one sat in
 * a policy file.
 */
export function PayrollPensionContributionsCard({
  pension, pensionError, downloading, onDownload,
}: {
  pension: PensionSchedule | null;
  pensionError: string | null;
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pension contributions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pensionError && <p className="text-sm text-destructive">{pensionError}</p>}

        {pension && (
          <>
            <p className="text-xs text-muted-foreground">{pension.notice}</p>
            <p className="text-xs text-muted-foreground">{pension.providerNotice}</p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Members', String(pension.totals.people)],
                ['Employee', money(pension.totals.employeePence / 100)],
                ['Employer', money(pension.totals.employerPence / 100)],
                ['Total to pay', money(pension.totals.totalPence / 100)],
              ].map(([label, value]) => (
                <div key={label} className="rounded border p-2">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>

            {/* ⚠️ Named, never a silent omission. A provider reconciling a schedule
                that quietly leaves three people out sees a total that is simply
                wrong; one that says who is missing sends somebody to look. */}
            {pension.excluded?.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-1 dark:border-amber-800 dark:bg-amber-950">
                <p className="text-sm font-medium">
                  {pension.excluded.length} {pension.excluded.length === 1 ? 'period' : 'periods'} could not be
                  included
                </p>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {pension.excluded.map((e, i) => (
                    <li key={i}>
                      <span className="font-medium">{e.name}</span>, period {e.periodNumber} — {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ⚠️ Said even when zero, like the other reports: "how many periods
                were left out" is not something to have to ask for on a screen
                about money owed to somebody else. */}
            {pension.draftRunsExcluded > 0 && (
              <p className="text-xs text-muted-foreground">
                {pension.draftRunsExcluded} draft {pension.draftRunsExcluded === 1 ? 'payroll is' : 'payrolls are'}
                {' '}not included — a contribution can only be collected on a payroll that has been agreed.
              </p>
            )}

            {pension.rows?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has a pension contribution in this tax year.
              </p>
            ) : (
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-1 pr-2">Period</th>
                      <th scope="col" className="py-1 pr-2">Name</th>
                      <th scope="col" className="py-1 pr-2 text-right">Pensionable pay</th>
                      <th scope="col" className="py-1 pr-2 text-right">Employee</th>
                      <th scope="col" className="py-1 pr-2 text-right">Employer</th>
                      <th scope="col" className="py-1 pr-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pension.rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1 pr-2 text-xs text-muted-foreground">{r.periodNumber}</td>
                        <td className="py-1 pr-2">{r.name}</td>
                        <td className="py-1 pr-2 text-right">{money(r.pensionableEarningsPence / 100)}</td>
                        <td className="py-1 pr-2 text-right">{money(r.employeePensionPence / 100)}</td>
                        <td className="py-1 pr-2 text-right">{money(r.employerPensionPence / 100)}</td>
                        <td className="py-1 pr-2 text-right font-medium">{money(r.totalPence / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button variant="outline" size="sm" disabled={downloading === 'pension'}
              onClick={onDownload}>
              {downloading === 'pension' ? 'Preparing…' : 'Download for the pension provider (CSV)'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

