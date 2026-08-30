import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { money } from '@/lib/payrollReportFormat';
import type { AbsenceReportResponse } from '@/lib/payrollReportEndpoints';

/**
 * ⚠️ ACHU-401 (felia 34) — cardul ăsta își ținea propria copie a formei serverului, cu doar
 * câmpurile pe care le desenează. ⛔ A doua copie e chiar greșeala ACHU-741, iar aici a și
 * prins-o: copia știa `types: string[]`, eu scrisesem `number` în tipul publicat.
 */
type FamilyLeaveReport = AbsenceReportResponse['family'];

/**
 * ── Family leave (ACHU-340) ─────────────────────────────────────────────────
 * Reported in WEEKS, because that is the unit the statute and the pay engine
 * use. The 109% recovery is shown as a SEPARATE figure and never netted off —
 * see the notice at the bottom.
 */
export function PayrollFamilyLeaveReportCard({
  leaveYearLabel, family, downloading, onDownload,
}: {
  leaveYearLabel: string;
  family: FamilyLeaveReport;
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Family leave — {leaveYearLabel}</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === 'family'}
          onClick={onDownload}>
          {downloading === 'family'
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-auto">
        {family.people.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No maternity, paternity, adoption or other family leave recorded in {leaveYearLabel}.
          </p>
        )}

        {family.people.length > 0 && (
          <>
            <div tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-2">Name</th>
                    <th scope="col" className="py-1 pr-2 text-right">Weeks paid</th>
                    <th scope="col" className="py-1 pr-2 text-right">Statutory pay</th>
                    <th scope="col" className="py-1 pr-2 text-right">Top-up</th>
                    <th scope="col" className="py-1 pr-2 text-right">Paid out</th>
                    <th scope="col" className="py-1 text-right">Reclaimable</th>
                  </tr>
                </thead>
                <tbody>
                  {family.people.map((f) => (
                    <tr key={f.cleanerId} className="border-b last:border-0 align-top">
                      <td className="py-1 pr-2">
                        {f.name}
                        {/* The kind of leave matters here in a way it does not
                            for sickness — maternity and a day off for a
                            dependant are not the same event. */}
                        <div className="text-xs text-muted-foreground">{f.types.join(', ')}</div>
                        {f.plannedSpells > 0 && (
                          <span className="text-xs text-amber-700 dark:text-amber-500">
                            {f.plannedSpells} planned, not started
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right">{f.weeksPaid}</td>
                      <td className="py-1 pr-2 text-right">{money(f.statutory)}</td>
                      <td className="py-1 pr-2 text-right">
                        {money(f.companyTopUp)}
                        {f.companyTopUpUndecided > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {f.companyTopUpUndecided} not decided
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right font-medium">{money(f.paidOut)}</td>
                      <td className="py-1 text-right">{money(f.reclaimable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm">
              Paid out <strong>{money(family.totals.paidOut)}</strong>.
              {' '}<strong>{money(family.totals.reclaimable)}</strong> of that can be reclaimed from HMRC
              and <strong>has not been</strong>.
            </p>

            {/* 🔴 The single most misleading thing this page could do is
                show a net cost. It does not, and this says why. */}
            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{family.recoveryNotice}</span>
            </p>
            {family.recoveryUnknownNotice && (
              <p className="text-xs text-amber-700 dark:text-amber-500">{family.recoveryUnknownNotice}</p>
            )}
            <p className="text-xs text-muted-foreground">{family.plannedNotice}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

