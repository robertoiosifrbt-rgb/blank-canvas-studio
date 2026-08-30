import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Info, Loader2 } from 'lucide-react';
import { money } from '@/lib/payrollReportFormat';
import type { AbsenceReportResponse } from '@/lib/payrollReportEndpoints';

/** ⚠️ ACHU-401 (felia 34) — forma vine din răspuns, nu dintr-o copie locală (ACHU-741). */
type SicknessReport = AbsenceReportResponse['sickness'];

/** ── Sickness (ACHU-339) ──────────────────────────────────────────────────── */
export function PayrollSicknessReportCard({
  leaveYearLabel, sickness, downloading, onDownload,
}: {
  leaveYearLabel: string;
  sickness: SicknessReport;
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Sickness — {leaveYearLabel}</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === 'sickness'}
          onClick={onDownload}>
          {downloading === 'sickness'
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-auto">
        {sickness.people.length === 0 && (
          <p className="text-sm text-muted-foreground">No sickness recorded in {leaveYearLabel}.</p>
        )}

        {sickness.people.length > 0 && (
          <>
            <div tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-2">Name</th>
                    <th scope="col" className="py-1 pr-2 text-right">Episodes</th>
                    <th scope="col" className="py-1 pr-2 text-right">Days off</th>
                    <th scope="col" className="py-1 pr-2 text-right">SSP days</th>
                    <th scope="col" className="py-1 pr-2 text-right">SSP</th>
                    <th scope="col" className="py-1 text-right">Company sick pay</th>
                  </tr>
                </thead>
                <tbody>
                  {sickness.people.map((s) => (
                    <tr key={s.cleanerId} className="border-b last:border-0">
                      <td className="py-1 pr-2">
                        {s.name}
                        {s.openSpells > 0 && (
                          <span className="ml-1 text-xs text-amber-700 dark:text-amber-500">
                            ({s.openSpells} still open)
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-right">{s.spells}</td>
                      <td className="py-1 pr-2 text-right">{s.daysAbsentEnded}</td>
                      <td className="py-1 pr-2 text-right">{s.sspDaysPaid}</td>
                      <td className="py-1 pr-2 text-right">{money(s.ssp)}</td>
                      <td className="py-1 text-right">
                        {money(s.companySickPay)}
                        {/* Undecided is not nil, and the difference is money
                            somebody still has to decide about. */}
                        {s.companySickPayUndecided > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {s.companySickPayUndecided} not decided
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sickness.openNotice && (
              <p className="text-xs text-muted-foreground">{sickness.openNotice}</p>
            )}
            {sickness.totals.crossesYearEnd > 0 && (
              <p className="text-xs text-muted-foreground">{sickness.yearNotice}</p>
            )}
            {/* The one that prevents a day of reconciliation: these figures
                are off the sickness records, not off payslips. */}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{sickness.moneyNotice}</span>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

