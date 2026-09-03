import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { money } from '@/lib/payrollReportFormat';

interface PayrollPeriod {
  periodNumber: number;
  payDate: string;
  totals: { people: number; gross: number; totalEmployerCost: number };
}

/** ── Period by period ─────────────────────────────────────────────────────── */
export function PayrollPeriodByPeriodCard({ periods }: { periods: PayrollPeriod[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Period by period</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2">Period</th>
              <th scope="col" className="py-1 pr-2">Paid</th>
              <th scope="col" className="py-1 pr-2 text-right">People</th>
              <th scope="col" className="py-1 pr-2 text-right">Gross</th>
              <th scope="col" className="py-1 text-right">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.periodNumber} className="border-b last:border-0">
                <td className="py-1 pr-2">{p.periodNumber}</td>
                <td className="py-1 pr-2">{p.payDate}</td>
                <td className="py-1 pr-2 text-right">{p.totals.people}</td>
                <td className="py-1 pr-2 text-right">{money(p.totals.gross)}</td>
                <td className="py-1 text-right">{money(p.totals.totalEmployerCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

