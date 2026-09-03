import { useEffect, useState, useCallback } from 'react';
import { getMonthlySummary, exportMonthlySummary, type MonthlySummaryResponse } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Download, Scale } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { fmt } from '@/lib/format';

/**
 * §26 „Monthly financial summary" · „Cash received versus invoiced" · „Cash-basis versus
 * invoice-basis reports" · „Export for accountant" (Sesiunea 154).
 *
 * ─── 🔴 De ce ecranul arată DOUĂ coloane și nu un total ─────────────────────
 * „Cât a făcut firma luna asta?" are două răspunsuri, amândouă corecte: cât s-a **facturat** (munca
 * e făcută, hârtia e emisă) și câți bani au **intrat**. ⛔ Un singur total ar fi ales tăcut o bază de
 * contabilitate în locul owner-ului — iar care bază se aplică firmei e o întrebare pentru contabil,
 * exact ca la TVA.
 *
 * ⚠️ **Propoziția de reconciliere stă SUS, înaintea cifrelor:** două totaluri diferite pentru aceeași
 * lună, fără nimic între ele, deschid o întrebare în loc să o închidă — iar prima bănuială a oricui e
 * că una dintre ele e greșită.
 *
 * ⛔ **Ce ecranul NU spune, deliberat:** cât din facturile lunii a fost plătit. O plată e legată de o
 * **vizită**, nu de o factură (§23, hotărâre nedată), deci răspunsul ar fi o ghiceală care arată
 * exactă. 🔴 Ce se poate spune — și se spune, cu cifra ei — e cât din banii intrați **nu are nicio
 * factură** în spate.
 */

/** Luna, scrisă pentru un om: „2026-08" → „Aug 2026". ⚠️ Fără zi: rândul e o lună întreagă. */
function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const name = names[Number(m) - 1];
  return name ? `${name} ${year}` : month;
}

/** ⚠️ Roșu doar pe minus: o mișcare de casă negativă e singura care cere ceva. */
const cashTone = (v: number) => (v < 0 ? 'text-red-600 dark:text-red-400' : '');

export default function MonthlySummaryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<MonthlySummaryResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getMonthlySummary({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;

  const download = async () => {
    setBusy(true);
    try {
      await exportMonthlySummary({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the summary.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Scale className="h-5 w-5" />}
        title="Monthly summary"
        description="Month by month, on both bases: what was invoiced, and what money actually moved."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="ms-from">From</Label>
            <DateField id="ms-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="ms-to">To</Label>
            <DateField id="ms-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || !data || data.byMonth.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export for accountant'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for this year so far. An invoice counts in the month it was ISSUED; money counts in the
            month it ARRIVED. Voided invoices and voided payments are left out of both — a correction is not work
            done and not money moved.
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
          {/* ─── 🔴 Reconcilierea, ÎNAINTEA cifrelor ──────────────────────── */}
          <Card className="p-3">
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.reconcileNote}</span>
            </p>
          </Card>

          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Invoiced</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.invoiced.gross)}</p>
                <p className="text-xs text-muted-foreground">{data.invoiced.count} invoices</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Money in</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.cash.net)}</p>
                <p className="text-xs text-muted-foreground">{data.cash.receivedCount} payments, {data.cash.refundedCount} refunded</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Money out</p>
                <p className="text-2xl font-semibold tabular-nums">{fmt(data.spend.total)}</p>
                <p className="text-xs text-muted-foreground">{data.spend.count} expenses</p>
              </div>
              <div>
                {/* ⛔ „Cash movement", nu „profit": nu ține cont de munca făcută și neîncasată. */}
                <p className="text-xs text-muted-foreground">Cash movement</p>
                <p className={`text-2xl font-semibold tabular-nums ${cashTone(data.netCash)}`}>{fmt(data.netCash)}</p>
                <p className="text-xs text-muted-foreground">In minus out — not profit</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Month by month</h2>
              {/* ⚠️ Decalajul se vede numai aici: o lună cu mult facturat și puțin încasat e un client care plătește târziu. */}
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Month</th>
                      <th scope="col" className="py-2 pr-3 text-right">Invoiced</th>
                      <th scope="col" className="py-2 pr-3 text-right">Money in</th>
                      <th scope="col" className="py-2 pr-3 text-right">Money out</th>
                      <th scope="col" className="py-2 text-right">Cash movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMonth.length === 0 && (
                      <tr><td colSpan={5} className="py-3 text-muted-foreground">Nothing was invoiced and no money moved in this period.</td></tr>
                    )}
                    {data.byMonth.map(m => (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{monthLabel(m.month)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.invoicedGross)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.cashNet)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.spend)}</td>
                        <td className={`py-2 text-right tabular-nums ${cashTone(m.netCash)}`}>{fmt(m.netCash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">VAT recorded</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">On invoices out</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(data.invoiced.vat)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On receipts in</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(data.spend.vat)}</p>
                </div>
              </div>
              {/* ⛔ Nu „de plată" și nu „de recuperat" — depinde de înregistrarea în scopuri de TVA. */}
              <p className="text-xs text-muted-foreground">{data.notes.vat}</p>
            </CardContent>
          </Card>

          {/* ⚠️ Limitele se SPUN, și vin de la server ca să nu se poată învechi aici. */}
          <Card>
            <CardContent className="pt-6 space-y-1.5 text-xs text-muted-foreground">
              <p>{data.notes.twoBases}</p>
              <p>{data.notes.noAllocation}</p>
              <p>{data.notes.voided}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

