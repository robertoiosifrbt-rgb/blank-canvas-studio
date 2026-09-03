/**
 * ACHU-537 (Sesiunea 119) — ce au spus clienții despre curățeniile lor, și cum se mișcă în timp.
 *
 * 🔴 Construită în ACEEAȘI felie cu butonul din portal, nu după. Motivul e o lecție plătită
 * de două ori în acest proiect: în aceeași zi, ACHU-536 — serverul calcula un preview pe care
 * niciun ecran nu îl afișa; și mai devreme, o cerere de ofertă putea fi creată fără ca nimeni
 * din birou să o poată vedea. O notă pe care clientul o dă și nimeni nu o citește e mai rea
 * decât lipsa funcționalității: clientul crede că a fost auzit.
 *
 * ⛔ **Read-only, și asta e o decizie, nu o etapă.** Biroul nu poate schimba și nu poate
 * șterge o notă — nici măcar una nedreaptă (ruta nici nu are cum). Nota e părerea clientului
 * despre propria vizită; un birou care ar putea edita-o ar transforma „satisfacția
 * clienților" într-o cifră despre sine.
 */
import { useEffect, useState, useCallback } from 'react';
import { getJobRatings } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, RefreshCw, AlertCircle, MessageSquare, TrendingUp } from 'lucide-react';
import RatingBreakdownCards from './RatingBreakdownCards';
import RatingFollowUp from './RatingFollowUp';
import { fmtDate } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

type RatingsPayload = Awaited<ReturnType<typeof getJobRatings>>;

/** Aceleași cuvinte ca în notificarea biroului (`jobRatingPolicy.ts`), ca să nu existe două vocabulare. */
const SCORE_WORD: Record<number, string> = {
  1: 'Very poor', 2: 'Poor', 3: 'OK', 4: 'Good', 5: 'Excellent',
};

function Stars({ score, className = 'h-4 w-4' }: { score: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${className} ${s <= score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  );
}

export default function CustomerFeedbackPage() {
  const req = useTrackedRequest<RatingsPayload>({ timeoutMs: 30000 });
  const [score, setScore] = useState('All');
  const [onlyComments, setOnlyComments] = useState(false);

  /**
   * ⚠️ `fire` extras din obiect, nu `req.fire` în lista de dependențe — și nu e stil.
   * `[req.fire, …]` produce un avertisment `exhaustive-deps` („dependency: 'req'"), iar
   * clichetul de lint al repo-ului e EXACT (`CLAUDE.md` §2.1a): un singur avertisment nou
   * sparge buildul, și se scoate avertismentul, nu se ridică pragul. `fire` e deja stabil
   * (`useCallback` în `useTrackedRequest`), deci extragerea nu schimbă nimic la execuție.
   */
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getJobRatings({
      ...(score === 'All' ? {} : { score: Number(score) }),
      ...(onlyComments ? { withComment: 'true' as const } : {}),
    }));
  }, [fire, score, onlyComments]);

  useEffect(() => { load(); }, [load]);

  const summary = req.data?.summary;
  const records = req.data?.records ?? [];
  const trend = req.data?.trend ?? [];
  /**
   * §36 — desfacerea pe curățător și pe serviciu. ⚠️ Vine cu ACELAȘI răspuns ca tendința
   * firmei, deci nu se reîncarcă separat și nu poate arăta o fereastră diferită de a ei.
   */
  const byCleaner = req.data?.byCleaner ?? [];
  const byService = req.data?.byService ?? [];
  const showSkeleton = !req.data && !req.error;
  // ⚠️ Scala barelor e maximul REAL, nu 100%: cu 3 note, o bară plină la „5 stele" ar
  // sugera un procent, nu un număr. Minim 1, ca să nu se împartă la zero.
  const maxBar = Math.max(1, ...Object.values(summary?.distribution ?? {}));
  const maxTrendCount = Math.max(1, ...trend.map(t => t.count));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Customer Feedback</h2>
          {summary && summary.count > 0 && (
            <Badge className="bg-amber-100 text-amber-800">
              {summary.average}/5 from {summary.count} {summary.count === 1 ? 'rating' : 'ratings'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={score} onValueChange={setScore}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by score"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All ratings</SelectItem>
              {[5, 4, 3, 2, 1].map(s => (
                <SelectItem key={s} value={String(s)}>{s} star{s === 1 ? '' : 's'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={onlyComments ? 'default' : 'outline'} size="sm" onClick={() => setOnlyComments(v => !v)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" />With comment
          </Button>
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
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : (
        <>
          {/**
            * ⛔ Blocul de cifre apare doar când EXISTĂ note. Cu zero note ar fi arătat
            * „average: —" și cinci bare goale, adică un raport care pare stricat în loc să
            * spună că nimeni n-a notat încă.
            */}
          {summary && summary.count === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Star className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No ratings yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Customers can rate a job from their portal once it is marked Completed.
                </p>
              </CardContent>
            </Card>
          ) : summary && (
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{summary.average}</span>
                    <span className="text-sm text-muted-foreground">/ 5</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {summary.withComment} of {summary.count} wrote something
                    </span>
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map(s => {
                      const n = summary.distribution[String(s)] ?? 0;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-xs w-3 text-right text-muted-foreground">{s}</span>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                          <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${(n / maxBar) * 100}%` }} />
                          </div>
                          <span className="text-xs w-8 text-muted-foreground">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />Last 12 months
                  </div>
                  {/**
                    * ⚠️ Lunile GOALE sunt afișate, cu „—", nu sărite (vezi `monthlyTrend` pe
                    * server): două luni alăturate care sar peste trei luni tăcute ar sugera o
                    * schimbare de la o lună la alta care nu s-a întâmplat.
                    */}
                  <div className="flex items-end gap-1 h-24">
                    {trend.map(t => (
                      <div key={t.month} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.month}: ${t.average ?? 'no ratings'}${t.count ? ` (${t.count})` : ''}`}>
                        <span className="text-[10px] text-muted-foreground">{t.average ?? '—'}</span>
                        <div
                          className={`w-full rounded-t ${t.count ? 'bg-amber-400' : 'bg-muted'}`}
                          // Înălțimea e MEDIA (cât de mulțumiți), nu numărul de note — iar
                          // opacitatea spune câte au fost, ca o lună cu o singură notă de 5
                          // să nu arate ca un triumf.
                          style={{ height: `${t.average ? (t.average / 5) * 100 : 4}%`, opacity: t.count ? 0.35 + 0.65 * (t.count / maxTrendCount) : 1 }}
                        />
                        <span className="text-[10px] text-muted-foreground">{t.month.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/**
            * §36 — „Cleaner rating trends" / „Service rating trends". ⛔ Apar sub cifrele
            * firmei și **doar** când există note: cu zero note, două tabele goale ar arăta ca
            * un raport stricat, exact ca blocul de sus.
            */}
          {summary && summary.count > 0 && (
            <RatingBreakdownCards
              byCleaner={byCleaner}
              byService={byService}
              minRatingsToJudge={req.data?.minRatingsToJudge ?? 3}
            />
          )}

          {records.length === 0 && summary && summary.count > 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No ratings match this filter.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Stars score={r.score} />
                          <span className="text-xs text-muted-foreground">{SCORE_WORD[r.score] ?? ''}</span>
                          <span className="font-medium text-sm">{r.customerName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">#{r.jobNumber}</span> • {r.service || 'Cleaning'} • {fmtDate(r.jobDate)}
                          {r.cleaners.length > 0 && <> • {r.cleaners.join(', ')}</>}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p>{fmtDate(String(r.createdAt).slice(0, 10))}</p>
                        {/* Arătat doar când există: „a schimbat nota" e o informație pe care
                            biroul o vrea; o dată egală cu cea de creare nu e. */}
                        {r.updatedAt && <p className="italic">changed {fmtDate(String(r.updatedAt).slice(0, 10))}</p>}
                        {r.customerEmail && <p className="break-all">{r.customerEmail}</p>}
                        {r.customerPhone && <p>{r.customerPhone}</p>}
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-sm bg-muted/40 rounded-lg p-2 whitespace-pre-wrap">{r.comment}</p>
                    )}
                    {/**
                      * §36 — urmărirea, chiar sub ce a scris clientul: cine sună are nevoie de
                      * cuvintele lui în față, nu pe alt ecran. `load` reîncarcă lista, ca la
                      * restul: starea peticită de mână ar fi a doua cale prin care ecranul află
                      * ce s-a salvat.
                      */}
                    <RatingFollowUp
                      ratingId={r.id}
                      followUp={r.followUp}
                      needsFollowUp={r.needsFollowUp}
                      onDone={load}
                    />
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

