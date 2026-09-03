import { useEffect, useState, useCallback } from 'react';
import { getExpenseReport, exportExpenseReport, type ExpenseReportResponse, type SpendGroup } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, Receipt, Download } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { fmt, fmtDate } from '@/lib/format';

/**
 * §38 „Expenses report" (Sesiunea 154) — CE S-A CHELTUIT, PE CE, ȘI CU CE HÂRTIE ÎN SPATE.
 *
 * ─── 🔴 Ce e cifra care contează, și nu e totalul ───────────────────────────
 * Totalul se vedea deja pe prima pagină. ⚠️ Ce **nu** se vedea nicăieni e **cât din el nu are
 * chitanța atașată** — singura cifră de aici care se poate încă **repara**: se caută hârtia acum, nu
 * la un control. De asta propoziția despre chitanțe stă sus, înaintea tabelelor.
 *
 * ─── ⛔ Ce NU spune ecranul ─────────────────────────────────────────────────
 * 🔴 **TVA „consemnat", nu „de recuperat".** Dacă vreun ban din el se poate recupera depinde de
 * înregistrarea în scopuri de TVA — o hotărâre a owner-ului și o întrebare pentru contabil. ⛔ Iar
 * cifra vine cu „pe câte rânduri a fost citit": fără ea, „£0" arată ca o firmă fără TVA, când de fapt
 * nimeni nu l-a scris de pe chitanțe.
 */

/** ⛔ „—", nu „0%": fără numitor nu există procent. */
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

/** Un tabel de grup. ⚠️ Coloana „fără chitanță" e a doua cifră, nu o notă de subsol. */
function GroupTable({ title, groups, nameHeader }: { title: string; groups: SpendGroup[]; nameHeader: string }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <h2 className="font-medium">{title}</h2>
        <div tabIndex={0} className="overflow-x-auto pt-1">
          <table className="w-full text-sm" aria-label={title}>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3">{nameHeader}</th>
                <th scope="col" className="py-2 pr-3">Expenses</th>
                <th scope="col" className="py-2 pr-3 text-right">Total</th>
                <th scope="col" className="py-2 pr-3 text-right">Share</th>
                <th scope="col" className="py-2 text-right">No receipt</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-muted-foreground">Nothing in this period.</td></tr>
              )}
              {groups.map(g => (
                <tr key={g.key} className="border-b last:border-0">
                  <td className="py-2 pr-3">{g.key}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(g.total)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pct(g.percentOfTotal)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {g.withoutReceipt === 0
                      ? <span className="text-muted-foreground">—</span>
                      : <span className="text-amber-700 dark:text-amber-400">{g.withoutReceipt} · {fmt(g.withoutReceiptTotal)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExpenseReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<ExpenseReportResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getExpenseReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  const download = async () => {
    setBusy(true);
    try {
      await exportExpenseReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  const missing = (data?.totals.withoutReceipt ?? 0) > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Receipt className="h-5 w-5" />}
        title="Spend by category"
        description="Where the money went in a period — and how much of it has no receipt attached."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="er-from">From</Label>
            <DateField id="er-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="er-to">To</Label>
            <DateField id="er-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || !data?.totals.count}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the current month. Voided expenses are left out — a correction is not money spent.
          </p>
        </CardContent>
      </Card>

      {req.error && (
        <Card>
          <CardContent className="pt-6 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span>{req.error}</span>
          </CardContent>
        </Card>
      )}

      {req.loading && !data && <Skeleton className="h-32 w-full" />}

      {data && (
        <>
          {/* ─── Hârtia, ÎNAINTEA cifrelor: e singura care se poate repara ─── */}
          <Card className={`p-3 ${missing ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
            <p className={`flex gap-2 text-xs ${missing ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
              {missing
                ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{data.receiptNote}</span>
            </p>
          </Card>

          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-2xl font-semibold tabular-nums">{data.totals.count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.totals.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Without a receipt</p>
                <p className={`text-2xl font-semibold tabular-nums ${missing ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                  {fmt(data.totals.withoutReceiptTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">VAT recorded</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.totals.vatRecorded)}</p>
                {/* ⚠️ Pe câte rânduri: fără asta, „£0" s-ar citi ca „firma nu are TVA". */}
                <p className="text-xs text-muted-foreground">
                  on {data.totals.vatRowCount} of {data.totals.count}
                </p>
              </div>
            </CardContent>
          </Card>

          <GroupTable title="By category" groups={data.byCategory} nameHeader="Category" />
          <GroupTable title="By supplier" groups={data.bySupplier} nameHeader="Supplier" />

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Largest in the period</h2>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Expense</th>
                      <th scope="col" className="py-2 pr-3">Date</th>
                      <th scope="col" className="py-2 pr-3">Supplier</th>
                      <th scope="col" className="py-2 pr-3">Category</th>
                      <th scope="col" className="py-2 pr-3 text-right">Amount</th>
                      <th scope="col" className="py-2">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.largest.length === 0 && (
                      <tr><td colSpan={6} className="py-3 text-muted-foreground">Nothing in this period.</td></tr>
                    )}
                    {data.largest.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">#{r.expenseId}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="py-2 pr-3">{r.supplier}</td>
                        <td className="py-2 pr-3">{r.category}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.amount)}</td>
                        <td className="py-2">
                          {r.hasReceiptFile
                            ? <span className="text-muted-foreground text-xs">attached</span>
                            : <span className="text-amber-700 dark:text-amber-400 text-xs">missing</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ⚠️ Limitele se SPUN, și vin de la server ca să nu se poată învechi aici. */}
          <Card>
            <CardContent className="pt-6 space-y-1.5 text-xs text-muted-foreground">
              <p>{data.notes.sameAsDashboard}</p>
              <p>{data.notes.vat}</p>
              <p>{data.notes.notProfit}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

