/**
 * 🔴 §24 „Aged receivables" (Sesiunea 153) — **CINE NE DATOREAZĂ BANI, ȘI DE CÂT TIMP.**
 *
 * ─── De ce există ───────────────────────────────────────────────────────────
 * Aplicația știa de mult **cât** se datorează („Money to Collect" din Action Centre). ⛔ Nu știa **de
 * cât timp** — iar aceea e singura întrebare care schimbă ce faci: o factură neplătită de trei zile e
 * o chitanță care n-a ajuns încă; una de trei luni e o discuție pe care nimeni n-a purtat-o.
 *
 * ⚠️ **Vechimea se numără de la SCADENȚĂ**, nu de la emitere: termenul e scris pe factură, deci
 * „întârziat" înseamnă „a trecut ce am promis noi".
 *
 * ─── ⛔ Ce spune pagina despre ea însăși ────────────────────────────────────
 * 🔴 **Ce NU e în raport e scris pe raport**, sus, nu într-o notă de subsol: facturile de termen
 * abonament nu se pot îmbătrâni, fiindcă o plată e legată de o **vizită**, nu de o factură — iar ce
 * plată stinge ce factură e o hotărâre pe care nimeni nu a luat-o. ⚠️ Fără propoziția aceea, cine
 * citește totalul crede că e toată datoria firmei.
 *
 * ⛔ **Nicio cifră nu se calculează aici.** Totul vine de la server, din singura socoteală de bani a
 * aplicației — inclusiv etichetele intervalelor.
 */
import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, Download, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import RefreshButton from '../shared/RefreshButton';
import { getAgedReceivables, exportAgedReceivables, type AgedReceivablesResponse } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { fmt, fmtDate } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';

/** ⚠️ Tonul crește cu vechimea, dar textul rămâne al serverului: culoarea nu e o afirmație nouă. */
const BUCKET_TONE: Record<string, string> = {
  '0-7': 'text-muted-foreground',
  '8-30': 'text-amber-600 dark:text-amber-400',
  '31-60': 'text-orange-600 dark:text-orange-400',
  '60+': 'text-red-600 dark:text-red-400',
};

export default function AgedReceivablesPage() {
  /**
   * ⚠️ **Tiparul casei pentru încărcare** (`useTrackedRequest`), ca la celelalte ecrane de birou: el
   * ține plafonul de timp, respinge un răspuns vechi sosit după unul nou, și păstrează datele
   * anterioare la eroare. ⛔ O încărcare scrisă de mână aici ar fi fost a patruzecea variantă.
   */
  const req = useTrackedRequest<AgedReceivablesResponse>({ timeoutMs: 30000 });
  const [busy, setBusy] = useState(false);

  // ⚠️ `fire` destructurat, nu `req.fire`: altfel `exhaustive-deps` cere tot obiectul ca dependență.
  const { fire } = req;
  const load = useCallback(() => { fire(() => getAgedReceivables()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const error = req.error;

  const download = async () => {
    setBusy(true);
    try {
      await exportAgedReceivables();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />Money owed, by age
          </h2>
          <p className="text-sm text-muted-foreground">
            Issued invoices with money still outstanding, counted from the date they were due.
            {data && <> As at {fmtDate(data.asOf)}.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => load()} />
          <Button size="sm" variant="outline" onClick={() => void download()} disabled={busy || !data?.rows.length}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Export
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2" role="alert">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>
        </div>
      )}

      {!data && !error && <Skeleton className="h-24 rounded-xl" />}

      {data && (
        <>
          {/*
            🔴 **CE NU E ÎN RAPORT, SUS, ÎNAINTEA CIFRELOR** — nu într-o notă de subsol. ⚠️ Fără el,
            totalul de dedesubt se citește ca „toată datoria firmei", iar el nu e asta.
          */}
          {data.notAged.count > 0 && (
            <Card className="border-amber-500/40">
              <CardContent className="p-4 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm">
                  <strong>{data.notAged.count} invoice{data.notAged.count === 1 ? '' : 's'}</strong> worth{' '}
                  {fmt(data.notAged.total)} {data.notAged.count === 1 ? 'is' : 'are'} not counted below.{' '}
                  <span className="text-muted-foreground">{data.notAged.reason}</span>
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            {data.buckets.map(b => (
              <Card key={b.key}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className={`text-2xl font-semibold ${BUCKET_TONE[b.key] ?? ''}`}>{fmt(b.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.count} invoice{b.count === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-sm">
                <strong>{fmt(data.totalOverdue)}</strong> overdue in total.
              </p>
              {/* ⚠️ Neplătit dar în termen: nu e o creanță veche, dar nici zero — și cine citește vrea să știe. */}
              <p className="text-xs text-muted-foreground">
                {data.notYetDue.count === 0
                  ? 'Nothing else is waiting to be paid inside its terms.'
                  : `${fmt(data.notYetDue.total)} more is unpaid but still inside its payment terms (${data.notYetDue.count} invoice${data.notYetDue.count === 1 ? '' : 's'}).`}
              </p>
            </CardContent>
          </Card>

          {data.rows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nothing is overdue.
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm" aria-label="Money owed, by age">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th scope="col" className="py-2 px-3">Invoice</th>
                    <th scope="col" className="py-2 px-3">Customer</th>
                    <th scope="col" className="py-2 px-3">Job</th>
                    <th scope="col" className="py-2 px-3">Due</th>
                    <th scope="col" className="py-2 px-3">Overdue</th>
                    <th scope="col" className="py-2 px-3 text-right">Invoiced</th>
                    <th scope="col" className="py-2 px-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.invoiceId} className="border-b last:border-0">
                      <td className="py-2 px-3 whitespace-nowrap font-medium">{r.invoiceNumber}</td>
                      <td className="py-2 px-3">{r.customerName}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{r.jobNumber === null ? '—' : `#${r.jobNumber}`}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                      <td className={`py-2 px-3 whitespace-nowrap ${BUCKET_TONE[r.bucket] ?? ''}`}>
                        {r.daysOverdue} day{r.daysOverdue === 1 ? '' : 's'}
                      </td>
                      <td className="py-2 px-3 text-right">{fmt(r.invoiced)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmt(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}

