/**
 * ACHU-540 (Sesiunea 119) — cine rămâne și cine pleacă.
 *
 * `Backlog_Client_Prioritar` Nivel 2: „Customers report / Recurring-customer report /
 * Customer-retention report" — trei rânduri de backlog care sunt un singur ecran, fiindcă
 * răspund la aceeași întrebare din trei unghiuri.
 *
 * 🔴 **Ecranul e o LISTĂ DE ACȚIUNE, nu un tabel de admirat.** De aceea filtrul de pe cei
 * plecați e la un click, iar sortarea implicită îi pune primii pe cei plecați de cel mai mult
 * timp: singurul lucru pe care biroul poate FACE cu raportul ăsta e să sune pe cineva.
 *
 * ⚠️ **Două coloane care pot să nu fie de acord, deliberat:** „Office" e ce a bifat biroul pe
 * fișă (`Customer.status`), „Standing" e ce s-a întâmplat (măsurat din vizitele efectuate). Un
 * client marcat „Active" care n-a mai fost curățat de patru luni e chiar informația pentru
 * care există ecranul — de aceea nu se ascunde niciuna în favoarea celeilalte.
 */
import { useEffect, useState, useCallback } from 'react';
import { getCustomerReport } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, RefreshCw, AlertCircle, TrendingUp, UserPlus, UserMinus } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

type ReportPayload = Awaited<ReturnType<typeof getCustomerReport>>;
type Standing = 'new' | 'active' | 'lapsed' | 'never';

/** Cuvintele pe care le citește biroul. Aceleași definiții ca pe server, exprimate pentru om. */
const STANDING_LABEL: Record<Standing, string> = {
  new: 'New',
  active: 'Active',
  lapsed: 'Lapsed',
  never: 'No jobs yet',
};

const STANDING_STYLE: Record<Standing, string> = {
  new: 'bg-sky-100 text-sky-800',
  active: 'bg-emerald-100 text-emerald-800',
  lapsed: 'bg-amber-100 text-amber-800',
  never: 'bg-muted text-muted-foreground',
};

export default function CustomerReportPage() {
  const req = useTrackedRequest<ReportPayload>({ timeoutMs: 30000 });
  const [standing, setStanding] = useState<Standing | 'All'>('All');

  // ⚠️ `fire` extras din obiect — `[req.fire, …]` produce un avertisment `exhaustive-deps`,
  // iar clichetul de lint e EXACT (`CLAUDE.md` §2.1a).
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getCustomerReport(standing === 'All' ? {} : { standing }));
  }, [fire, standing]);

  useEffect(() => { load(); }, [load]);

  const summary = req.data?.summary;
  const records = req.data?.records ?? [];
  const retention = req.data?.retention ?? [];
  const thresholds = req.data?.thresholds;
  const showSkeleton = !req.data && !req.error;
  // Scala barelor e maximul REAL: cu 3 clienți, o bară plină ar sugera un procent.
  const maxBar = Math.max(1, ...retention.map(r => Math.max(r.gained, r.lost, r.served)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Customer Report</h2>
          {summary && summary.lapsed > 0 && (
            <Badge className="bg-amber-100 text-amber-800">{summary.lapsed} lapsed</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['All', 'lapsed', 'active', 'new', 'never'] as const).map(key => (
            <Button
              key={key}
              variant={standing === key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setStanding(key)}
            >
              {key === 'All' ? 'All' : STANDING_LABEL[key]}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={load} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {req.error && (
        <div className="rounded-lg p-3 flex items-center gap-2 bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm flex-1 text-destructive">{req.error}</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={req.loading}>Retry</Button>
        </div>
      )}

      {showSkeleton ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : summary && summary.customers === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No customers yet.</p>
          </CardContent>
        </Card>
      ) : summary && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Customers" value={summary.customers} />
                  <Stat label={`New (last ${thresholds?.newWithinDays ?? 30} days)`} value={summary.newCustomers} />
                  <Stat label="Active" value={summary.active} />
                  <Stat label={`Lapsed (no job in ${thresholds?.lapsedAfterDays ?? 90} days)`} value={summary.lapsed} />
                  <Stat label="No jobs yet" value={summary.never} />
                  <Stat label="Came back (2+ jobs)" value={summary.repeat} />
                </div>
                <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                  {/* ⛔ `null` se scrie „—", nu 0%: un 0.0% ar afirma „nimeni nu se întoarce". */}
                  <span>Repeat rate: <span className="font-medium text-foreground">{summary.repeatRatePercent === null ? '—' : `${summary.repeatRatePercent}%`}</span></span>
                  <span>Avg jobs: <span className="font-medium text-foreground">{summary.averageVisits ?? '—'}</span></span>
                  <span>Total received: <span className="font-medium text-foreground">{fmt(summary.totalNetPaidPence / 100)}</span></span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />Last 12 months
                </div>
                {/* Trei bare per lună: câți oameni serviți, câți câștigați, câți pierduți.
                    ⚠️ „Pierdut" e numărat în luna ULTIMEI vizite — acolo s-a întâmplat. */}
                <div className="flex items-end gap-1 h-24">
                  {retention.map(point => (
                    <div key={point.month} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${point.month}: ${point.served} served, +${point.gained} gained, -${point.lost} lost`}>
                      <div className="w-full flex items-end justify-center gap-px h-16">
                        <div className="w-1/3 bg-muted-foreground/30 rounded-t" style={{ height: `${(point.served / maxBar) * 100}%` }} />
                        <div className="w-1/3 bg-emerald-500 rounded-t" style={{ height: `${(point.gained / maxBar) * 100}%` }} />
                        <div className="w-1/3 bg-amber-500 rounded-t" style={{ height: `${(point.lost / maxBar) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{point.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/30" />served</span>
                  <span className="flex items-center gap-1"><UserPlus className="h-3 w-3 text-emerald-600" />gained</span>
                  <span className="flex items-center gap-1"><UserMinus className="h-3 w-3 text-amber-600" />lost</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {records.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No customers match this filter.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <Card key={r.customerId}>
                  <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.customerName}</span>
                        <Badge className={STANDING_STYLE[r.standing]}>{STANDING_LABEL[r.standing]}</Badge>
                        {/* Ce a bifat biroul, arătat doar când diferă de măsurătoare — altfel
                            ar fi o a doua etichetă care spune același lucru. */}
                        {r.officeStatus && r.officeStatus !== 'Active' && (
                          <span className="text-xs text-muted-foreground">office: {r.officeStatus}</span>
                        )}
                        {r.repeat && <span className="text-xs text-muted-foreground">returning</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.visits} {r.visits === 1 ? 'job' : 'jobs'}
                        {r.lastVisit && <> • last {fmtDate(r.lastVisit)}{r.daysSinceLastVisit !== null && <> ({r.daysSinceLastVisit}d ago)</>}</>}
                        {r.firstVisit && <> • first {fmtDate(r.firstVisit)}</>}
                      </p>
                    </div>
                    <span className="text-sm font-medium shrink-0">{fmt(r.netPaidPence / 100)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-xl font-bold leading-tight">{value}</p>
    </div>
  );
}

