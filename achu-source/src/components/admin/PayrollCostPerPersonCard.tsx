import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { money } from '@/lib/payrollReportFormat';

interface PersonCost {
  cleanerId: string;
  name: string;
  periods: number;
  totals: { gross: number; netPay: number; totalEmployerCost: number };
  onTopOfWage: number;
}

/** ── Cost per person ──────────────────────────────────────────────────────── */
export function PayrollCostPerPersonCard({
  people, downloading, onDownload,
}: {
  people: PersonCost[];
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">What each person costs</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === 'people'}
          onClick={onDownload}>
          {downloading === 'people'
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2">Name</th>
              <th scope="col" className="py-1 pr-2 text-right">Periods</th>
              <th scope="col" className="py-1 pr-2 text-right">Gross</th>
              <th scope="col" className="py-1 pr-2 text-right">Net</th>
              <th scope="col" className="py-1 pr-2 text-right">On top of wage</th>
              <th scope="col" className="py-1 text-right">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.cleanerId} className="border-b last:border-0">
                <td className="py-1 pr-2">{p.name}</td>
                <td className="py-1 pr-2 text-right">{p.periods}</td>
                <td className="py-1 pr-2 text-right">{money(p.totals.gross)}</td>
                <td className="py-1 pr-2 text-right">{money(p.totals.netPay)}</td>
                <td className="py-1 pr-2 text-right">{money(p.onTopOfWage)}</td>
                <td className="py-1 text-right font-medium">{money(p.totals.totalEmployerCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

