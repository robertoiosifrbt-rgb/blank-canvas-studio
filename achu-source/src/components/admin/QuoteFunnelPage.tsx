import { useEffect, useState, useCallback } from 'react';
import { getQuoteFunnel, exportQuoteFunnel, type QuoteFunnelResponse } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Download, Filter } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { fmt } from '@/lib/format';

/**
 * §38 „Quote report / Conversion report / Source report" (Sesiunea 154) — CÂT DIN CE INTRĂ AJUNGE
 * MUNCĂ PLĂTITĂ.
 *
 * ─── 🔴 DOUĂ PÂLNII, ȘI ECRANUL LE ȚINE SEPARATE ────────────────────────────
 * Cererile de ofertă (ce a intrat) și ofertele de preț (cifra trimisă clientului) se numără
 * **separat**. ⛔ O vizită se poate face fără nicio ofertă scrisă — un abonament, un client vechi
 * care sună — iar o ofertă se poate scrie fără nicio cerere, calculată „pe curat". 🔴 O singură
 * „rată de conversie" peste amândouă ar fi avut un numitor pe care nimeni nu-l poate reconstitui,
 * adică o cifră pe care nimeni nu o poate verifica.
 *
 * ─── ⚠️ Cele două refuzuri care fac cifrele oneste, scrise pe ecran ─────────
 * **Duplicatele** ies din numitor (același om numărat de două ori nu e o oportunitate pierdută), și
 * **tăcerea nu e un refuz** (rata de acceptare e pe cele la care s-a răspuns). ⛔ Fără a doua, rata
 * ar fi arătat cel mai prost exact în lunile cu cele mai multe oferte scrise — ar fi pedepsit munca.
 */

/** O cifră, cu eticheta ei. ⚠️ Rândurile cu 0 rămân: aici zero e un fapt, nu o lipsă. */
function Figure({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** ⛔ „—", nu „0%": fără numitor nu există rată, iar 0% ar afirma că nimic nu s-a convertit. */
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export default function QuoteFunnelPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<QuoteFunnelResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getQuoteFunnel({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const error = req.error;

  const download = async () => {
    setBusy(true);
    try {
      await exportQuoteFunnel({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  const e = data?.enquiries;
  const q = data?.quotes;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Filter className="h-5 w-5" />}
        title="Enquiries and quotes"
        description="How much of what comes in turns into paid work — counted as two separate funnels."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="qf-from">From</Label>
            <DateField id="qf-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="qf-to">To</Label>
            <DateField id="qf-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || !data}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the current month. Each half is counted on its OWN date: an enquiry on the day it
            came in, a quote on the day it was written.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {req.loading && !data && <Skeleton className="h-32 w-full" />}

      {data && e && q && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-medium">Enquiries — what came in</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <Figure label="Received" value={e.received} hint={e.duplicates > 0 ? `${e.duplicates} of them duplicates` : undefined} />
                <Figure label="Became a job" value={e.converted} />
                <Figure label="Still open" value={e.stillOpen} hint={e.conversionErrors > 0 ? `${e.conversionErrors} stuck on an error` : undefined} />
                <Figure label="Turned into work" value={pct(e.conversionRate)} hint="Duplicates left out" />
              </div>
              {e.rejected > 0 && (
                <p className="text-xs text-muted-foreground">{e.rejected} were rejected.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Where it came from</h2>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Source</th>
                      <th scope="col" className="py-2 pr-3">Received</th>
                      <th scope="col" className="py-2 pr-3">Became a job</th>
                      <th scope="col" className="py-2">Turned into work</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-muted-foreground">No enquiries in this period.</td></tr>
                    )}
                    {data.bySource.map(s => (
                      <tr key={s.source} className="border-b last:border-0">
                        <td className="py-2 pr-3">{s.source}</td>
                        <td className="py-2 pr-3 tabular-nums">{s.received}</td>
                        <td className="py-2 pr-3 tabular-nums">{s.converted}</td>
                        <td className="py-2 tabular-nums">{pct(s.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">{data.notes.source}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-medium">Quotes — the price we sent</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <Figure label="Sent to the customer" value={q.sent} hint={q.drafts > 0 ? `${q.drafts} still a draft` : undefined} />
                <Figure label="Accepted" value={q.accepted} hint={fmt(q.acceptedValue)} />
                <Figure
                  label="No answer"
                  value={q.noAnswer}
                  hint={q.expiredUnanswered > 0 ? `${q.expiredUnanswered} already expired` : undefined}
                />
                <Figure label="Said yes, of those who answered" value={pct(q.acceptanceRate)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {q.rejected} rejected{q.revisionRequested > 0 ? `, ${q.revisionRequested} asked for a change` : ''}.
                {' '}Value sent: {fmt(q.sentValue)}.
              </p>
            </CardContent>
          </Card>

          {/* ⚠️ Limitele se SPUN, și vin de la server ca să nu se poată învechi aici. */}
          <Card>
            <CardContent className="pt-6 space-y-1.5 text-xs text-muted-foreground">
              <p>{data.notes.twoFunnels}</p>
              <p>{data.notes.duplicates}</p>
              <p>{data.notes.silence}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

