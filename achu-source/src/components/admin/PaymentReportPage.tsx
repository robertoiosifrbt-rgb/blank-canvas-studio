import { useEffect, useState, useCallback } from 'react';
import { getPaymentReport, exportPaymentReport, type PaymentReportResponse, type MoneyGroup } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Download, ArrowLeftRight } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { fmt, fmtDate } from '@/lib/format';

/**
 * §38 „Payments report / Refund report" (Sesiunea 154) — CE BANI AU INTRAT, PE CE DRUM, ȘI CE S-A
 * ÎNTORS.
 *
 * ─── 🔴 De ce ecranul arată DOUĂ totaluri ───────────────────────────────────
 * **Ce s-a consemnat** în perioadă, și **cât din el contează ca venit** pe prima pagină. ⚠️ Cele două
 * pot să difere legitim — banii primiți pe o vizită care nu poartă niciun preț (o cerere de ofertă)
 * sunt bani reali, dar Dashboard-ul numără doar ce a fost chiar facturat.
 *
 * ⛔ Alternativa era mai rea: un singur total, ales de mine, **diferit** de cel de pe prima pagină
 * pentru aceeași lună — iar întrebarea *„de ce scrie aici altceva?"* n-ar fi avut răspuns pe niciun
 * ecran. 🔴 De asta propoziția de reconciliere stă **sus**, înaintea tabelelor.
 *
 * ⚠️ **Rambursările au tabelul lor, pe MOTIV** — jumătatea pe care nicio listă de plăți nu o punea:
 * *„de ce dăm bani înapoi?"*.
 */

/** ⛔ „—", nu „0%": fără numitor nu există procent. */
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function GroupTable({ title, groups, nameHeader, empty }: { title: string; groups: MoneyGroup[]; nameHeader: string; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      <div tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={title}>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3">{nameHeader}</th>
              <th scope="col" className="py-2 pr-3">Payments</th>
              <th scope="col" className="py-2 pr-3 text-right">Total</th>
              <th scope="col" className="py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-muted-foreground">{empty}</td></tr>
            )}
            {groups.map(g => (
              <tr key={g.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{g.key}</td>
                <td className="py-2 pr-3 tabular-nums">{g.count}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmt(g.total)}</td>
                <td className="py-2 text-right tabular-nums">{pct(g.percentOfTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PaymentReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<PaymentReportResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getPaymentReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  const download = async () => {
    setBusy(true);
    try {
      await exportPaymentReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ArrowLeftRight className="h-5 w-5" />}
        title="Payments and refunds"
        description="What came in over a period, by what route — and what went back out, with the reason."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="pr-from">From</Label>
            <DateField id="pr-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="pr-to">To</Label>
            <DateField id="pr-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || !data || (data.received.count + data.refunded.count === 0)}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the current month. A payment counts in the month it was PAID, not the month it was
            typed in. Voided payments are left out — a voided payment is a correction, not money that moved.
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
          {/* ─── Reconcilierea cu prima pagină, ÎNAINTEA cifrelor ─────────── */}
          <Card className="p-3">
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.income.note}</span>
            </p>
          </Card>

          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Money in</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.received.total)}</p>
                <p className="text-xs text-muted-foreground">{data.received.count} payments</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Back out</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.refunded.total)}</p>
                <p className="text-xs text-muted-foreground">{data.refunded.count} refunds</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net recorded</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.net)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Of which counts as income</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.income.net)}</p>
                {data.income.excludedCount > 0 && (
                  <p className="text-xs text-muted-foreground">{data.income.excludedCount} not counted</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Money in</h2>
              <GroupTable title="By route" groups={data.received.byMethod} nameHeader="Method" empty="Nothing came in during this period." />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Money back out</h2>
              {/* ⚠️ Motivul e primul tabel: e întrebarea pe care nicio listă de plăți nu o punea. */}
              <GroupTable title="By reason" groups={data.refunded.byReason} nameHeader="Reason" empty="Nothing was refunded in this period." />
              {data.refunded.count > 0 && (
                <GroupTable title="By route" groups={data.refunded.byMethod} nameHeader="Method" empty="" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Largest payments in</h2>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Payment</th>
                      <th scope="col" className="py-2 pr-3">Date</th>
                      <th scope="col" className="py-2 pr-3">Customer</th>
                      <th scope="col" className="py-2 pr-3">Method</th>
                      <th scope="col" className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.largest.length === 0 && (
                      <tr><td colSpan={5} className="py-3 text-muted-foreground">Nothing came in during this period.</td></tr>
                    )}
                    {data.largest.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">#{r.paymentId}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date ? fmtDate(r.date) : '—'}</td>
                        <td className="py-2 pr-3">{r.customerName}</td>
                        <td className="py-2 pr-3">{r.method}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(r.amount)}</td>
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
              <p>{data.notes.twoTotals}</p>
              <p>{data.notes.refundReasons}</p>
              <p>{data.notes.notProfit}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

