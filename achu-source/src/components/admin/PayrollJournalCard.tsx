import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Info, Loader2 } from 'lucide-react';
import { money } from '@/lib/payrollReportFormat';

interface JournalEntry {
  account: string;
  note: string;
  debit: number;
  credit: number;
}

/** ── The journal ──────────────────────────────────────────────────────────── */
export function PayrollJournalCard({
  journal, journalBalanced, nominalCodesNotice, downloading, onDownload,
}: {
  journal: JournalEntry[];
  journalBalanced: boolean;
  nominalCodesNotice: string;
  downloading: string | null;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Payroll journal</CardTitle>
        <Button variant="outline" size="sm" disabled={downloading === 'journal'}
          onClick={onDownload}>
          {downloading === 'journal'
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <Download className="h-4 w-4 mr-1" />}
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2">Account</th>
              <th scope="col" className="py-1 pr-2 text-right">Debit</th>
              <th scope="col" className="py-1 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((e, i) => (
              <tr key={i} className="border-b last:border-0 align-top">
                <td className="py-1 pr-2">
                  {e.account}
                  <div className="text-xs text-muted-foreground">{e.note}</div>
                </td>
                <td className="py-1 pr-2 text-right">{e.debit > 0 ? money(e.debit) : ''}</td>
                <td className="py-1 text-right">{e.credit > 0 ? money(e.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Proven by the server. Shown because an accountant handed an
            unbalanced journal has to find the missing figure by hand. */}
        <p className={`text-xs ${journalBalanced ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>
          {journalBalanced
            ? 'Debits and credits balance.'
            : '⚠️ This journal does NOT balance — something is missing or counted twice. Do not import it.'}
        </p>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{nominalCodesNotice}</span>
        </p>
      </CardContent>
    </Card>
  );
}

