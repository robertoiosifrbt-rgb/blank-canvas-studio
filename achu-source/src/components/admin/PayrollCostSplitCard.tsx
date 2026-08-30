import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { money } from '@/lib/payrollReportFormat';

interface CostSplitGroup {
  label: string;
  assigned: boolean;
  attributedFromProfile: number;
  payments: number;
  people: number;
  totals: { gross: number; totalEmployerCost: number };
  onTopOfWage: number;
  shareOfCostPercent: number;
}

interface CostSplit {
  groups: CostSplitGroup[];
  accountsForEverything: boolean;
  notice?: string;
}

/** ── Cost by department, cost by cost centre (ACHU-343) ──────────────────── */
export function PayrollCostSplitCard({
  title, columnHeader, split, taxYear, downloadKind, downloading, onDownload,
}: {
  title: string;
  columnHeader: string;
  split: CostSplit;
  taxYear: string;
  downloadKind: 'departments' | 'cost-centres';
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === downloadKind}
          onClick={onDownload}>
          {downloading === downloadKind
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-auto">
        {split.groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing to split yet — no approved payroll in {taxYear}.
          </p>
        )}

        {split.groups.length > 0 && (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-2">{columnHeader}</th>
                  <th scope="col" className="py-1 pr-2 text-right">People</th>
                  <th scope="col" className="py-1 pr-2 text-right">Gross</th>
                  <th scope="col" className="py-1 pr-2 text-right">On top of wage</th>
                  <th scope="col" className="py-1 pr-2 text-right">Total cost</th>
                  <th scope="col" className="py-1 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {split.groups.map((g) => (
                  <tr key={g.label} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      {/* The unassigned row is styled as a gap, not as a
                          department called "Not assigned". */}
                      <span className={g.assigned ? '' : 'text-muted-foreground italic'}>{g.label}</span>
                      {g.attributedFromProfile > 0 && (
                        <div className="text-xs text-amber-700 dark:text-amber-500">
                          {g.attributedFromProfile} of {g.payments} grouped from the current profile
                        </div>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right">{g.people}</td>
                    <td className="py-1 pr-2 text-right">{money(g.totals.gross)}</td>
                    <td className="py-1 pr-2 text-right">{money(g.onTopOfWage)}</td>
                    <td className="py-1 pr-2 text-right font-medium">{money(g.totals.totalEmployerCost)}</td>
                    <td className="py-1 text-right">{g.shareOfCostPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Proven by the server, shown for the same reason as the
            journal balance: a split missing rows adds up to less than
            the wage bill and looks perfectly normal. */}
        {split.groups.length > 0 && !split.accountsForEverything && (
          <p className="text-xs font-medium text-destructive">
            ⚠️ These rows do NOT add up to the year's total cost — something is missing. Do not use
            this split until it does.
          </p>
        )}

        {split.notice && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{split.notice}</span>
          </p>
        )}

      </CardContent>
    </Card>
  );
}

