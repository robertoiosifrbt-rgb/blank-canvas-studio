import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Info, Loader2 } from 'lucide-react';
import { hours, money } from '@/lib/payrollReportFormat';

interface HolidayPerson {
  cleanerId: string;
  name: string;
  active: boolean;
  carriedInHours: number;
  accruedHours: number;
  takenHours: number;
  bookedHours: number;
  remainingHours: number;
  valueIfPaidOut: number | null;
}

interface HolidayReport {
  people: HolidayPerson[];
  totals: { remainingValue: number };
  valueNotice: string;
  rateNotice?: string;
  overTakenNotice?: string;
  leaveYearNotice: string;
}

/** ── Holiday (ACHU-339) ───────────────────────────────────────────────────── */
export function PayrollHolidayReportCard({
  leaveYearLabel, holiday, downloading, onDownload,
}: {
  leaveYearLabel: string;
  holiday: HolidayReport;
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Holiday — {leaveYearLabel}</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === 'holiday'}
          onClick={onDownload}>
          {downloading === 'holiday'
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-auto">
        {holiday.people.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody on payroll yet.</p>
        )}

        {holiday.people.length > 0 && (
          <>
            <div tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-2">Name</th>
                    <th scope="col" className="py-1 pr-2 text-right">Brought fwd</th>
                    <th scope="col" className="py-1 pr-2 text-right">Accrued</th>
                    <th scope="col" className="py-1 pr-2 text-right">Taken</th>
                    <th scope="col" className="py-1 pr-2 text-right">Booked</th>
                    <th scope="col" className="py-1 pr-2 text-right">Remaining</th>
                    <th scope="col" className="py-1 text-right">If paid out</th>
                  </tr>
                </thead>
                <tbody>
                  {holiday.people.map((p) => (
                    <tr key={p.cleanerId} className="border-b last:border-0">
                      <td className="py-1 pr-2">
                        {p.name}
                        {/* A leaver's untaken balance is a payment due, not
                            time off — worth seeing without opening a profile. */}
                        {!p.active && <span className="ml-1 text-xs text-muted-foreground">(leaver)</span>}
                      </td>
                      <td className="py-1 pr-2 text-right">{hours(p.carriedInHours)}</td>
                      <td className="py-1 pr-2 text-right">{hours(p.accruedHours)}</td>
                      <td className="py-1 pr-2 text-right">{hours(p.takenHours)}</td>
                      <td className="py-1 pr-2 text-right">{hours(p.bookedHours)}</td>
                      <td className={`py-1 pr-2 text-right font-medium ${p.remainingHours < 0 ? 'text-destructive' : ''}`}>
                        {hours(p.remainingHours)}
                      </td>
                      {/* An em dash, never £0.00: no rate is a missing figure,
                          not a balance worth nothing. */}
                      <td className="py-1 text-right">
                        {p.valueIfPaidOut == null ? '—' : money(p.valueIfPaidOut)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm">
              Untaken holiday is worth <strong>{money(holiday.totals.remainingValue)}</strong> if it were
              paid out.
            </p>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{holiday.valueNotice}</span>
            </p>
            {holiday.rateNotice && (
              <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{holiday.rateNotice}</span>
              </p>
            )}
            {holiday.overTakenNotice && (
              <p className="text-xs text-muted-foreground">{holiday.overTakenNotice}</p>
            )}
            <p className="text-xs text-muted-foreground">{holiday.leaveYearNotice}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

