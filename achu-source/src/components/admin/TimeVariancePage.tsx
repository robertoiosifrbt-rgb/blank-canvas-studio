import { useEffect, useState, useCallback } from 'react';
import { getTimeVariance, type TimeVarianceResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, Timer, TrendingUp, CheckCircle2 } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import EmptyTableRow from '../shared/EmptyTableRow';

/**
 * ACHU-288 (Sesiunea 69) — estimated vs actual time.
 *
 * The pricing question this business could not answer: **does a job sold as two
 * hours actually take two hours?** A price here is computed from a minutes
 * estimate (`minutes / 60 × rate`), so a service that consistently overruns is
 * sold short on every instance, and nothing said so.
 *
 * Backlog item 17 "Compare estimated versus actual", carried in nine consecutive
 * "what's next" lists across sessions 63–68b without being built. Both halves of
 * the data existed the whole time: the quote's minutes since Sesiunea 26, approved
 * timesheet hours since ACHU-267.
 *
 * ─── Per SERVICE first, not per job ─────────────────────────────────────
 * A single visit runs late for reasons nobody will repeat — traffic, a blocked
 * sink, a chatty customer. A SERVICE that runs 20% over across forty jobs is a
 * price that is wrong. So the service table is the headline and the per-job list
 * is underneath it, for looking into a specific case.
 *
 * ─── The coverage caveat is above every number ──────────────────────────
 * Same discipline as the profitability screen. A variance computed over three of
 * ninety jobs is a fact about those three, and the difference is invisible unless
 * something says it out loud.
 */

/** Red for over, green for under, muted for near enough. */
function toneFor(percent: number): string {
  if (percent >= 15) return 'text-red-700 dark:text-red-400';
  if (percent >= 5) return 'text-amber-700 dark:text-amber-400';
  if (percent <= -15) return 'text-emerald-700 dark:text-emerald-400';
  return 'text-muted-foreground';
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export default function TimeVariancePage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<TimeVarianceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTimeVariance({ ...(from ? { from } : {}), ...(to ? { to } : {}) })
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not work it out.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  // Defaults to the current month server-side, which is the question people ask.
  useEffect(() => { load(); }, [load]);

  const cov = data?.coverage;
  const services = data?.byService ?? [];
  const worst = data?.worstJobs ?? [];
  const nothingComparable = cov != null && cov.comparableJobs === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Timer className="h-5 w-5" />}
        title="Sold time vs worked time"
        description="A price here is built from a number of minutes. This says whether the work actually fits in them."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="tv-from">From</Label>
            <DateField id="tv-from" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tv-to">To</Label>
            <DateField id="tv-to" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={loading}>Apply</Button>
          </div>
          <p className="sm:col-span-3 text-xs text-muted-foreground">
            Leave both blank for the current month. A job is counted in the month it was WORKED, not the month it
            was quoted or the month its hours were typed in.
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

      {loading && !data && <Skeleton className="h-32 w-full" />}

      {/* ─── The caveat, FIRST — above every figure ────────────────────── */}
      {cov?.caveat && (
        <Card className={`p-3 ${
          nothingComparable ? 'border-amber-500/50 bg-amber-500/5'
            : (cov.percent != null && cov.percent < 50) ? 'border-amber-500/30 bg-amber-500/[0.03]'
              : 'border-border'
        }`}>
          <p className={`flex gap-2 text-xs ${
            nothingComparable || (cov.percent != null && cov.percent < 50)
              ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
          }`}>
            {nothingComparable || (cov.percent != null && cov.percent < 50)
              ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{cov.caveat}</span>
          </p>
        </Card>
      )}

      {data && !nothingComparable && (
        <>
          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Jobs compared</p>
                <p className="text-2xl font-semibold">{data.totals.comparableJobs}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time sold</p>
                <p className="text-2xl font-semibold">{data.totals.estimatedHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time worked</p>
                <p className="text-2xl font-semibold">{data.totals.actualHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={`text-2xl font-semibold ${toneFor(data.totals.variancePercent ?? 0)}`}>
                  {data.totals.variancePercent == null
                    ? '—'
                    : <>{signed(data.totals.variancePercent)}%</>}
                </p>
                <p className="text-xs text-muted-foreground">{signed(data.totals.varianceHours)}h</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-medium">By service — the one that matters</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Worst overrun first. One job running late is noise; a service running over on every job is a
                price that is too low.
              </p>

              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Service</th>
                      <th scope="col" className="py-2 pr-3">Jobs</th>
                      <th scope="col" className="py-2 pr-3">Sold</th>
                      <th scope="col" className="py-2 pr-3">Worked</th>
                      <th scope="col" className="py-2">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.length === 0 ? <EmptyTableRow colSpan={5}>No job in this period has both a sold time and approved hours.</EmptyTableRow> : services.map(s => (
                      <tr key={s.service} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          {s.service}
                          {/* Said per row, because a group whose figure rests on fewer
                              jobs than its count suggests is a different thing. */}
                          {s.jobsBelowThreshold > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {s.jobsBelowThreshold} too short to include in the percentage
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3">{s.jobCount}</td>
                        <td className="py-2 pr-3">{s.estimatedHours}h</td>
                        <td className="py-2 pr-3">{s.actualHours}h</td>
                        <td className={`py-2 font-medium whitespace-nowrap ${toneFor(s.variancePercent)}`}>
                          {signed(s.variancePercent)}% <span className="text-xs font-normal">({signed(s.varianceHours)}h)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Individual jobs that ran over</h2>
              {worst.length === 0 ? (
                <p className="flex gap-2 py-4 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>No job in this period took longer than the time it was sold as.</span>
                </p>
              ) : (
                <div tabIndex={0} className="overflow-x-auto pt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3">Date</th>
                        <th scope="col" className="py-2 pr-3">Job</th>
                        <th scope="col" className="py-2 pr-3">Customer</th>
                        <th scope="col" className="py-2 pr-3">Sold</th>
                        <th scope="col" className="py-2 pr-3">Worked</th>
                        <th scope="col" className="py-2">Over by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worst.map(j => (
                        <tr key={j.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">{j.date}</td>
                          <td className="py-2 pr-3">
                            #{j.reference}
                            <span className="block text-xs text-muted-foreground">{j.service}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {j.customerName}
                            {/* Two people on a job is not a longer job — it is the same
                                job costing twice the labour, and the quote is in labour
                                minutes, so this number explains the figures beside it. */}
                            {j.peopleCount > 1 && (
                              <span className="block text-xs text-muted-foreground">{j.peopleCount} people</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{j.estimatedHours}h</td>
                          <td className="py-2 pr-3">{j.actualHours}h</td>
                          <td className={`py-2 font-medium whitespace-nowrap ${toneFor(j.variancePercent)}`}>
                            {signed(j.variancePercent)}% <span className="text-xs font-normal">({signed(j.varianceHours)}h)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Both limits stated, because neither is visible from the numbers. */}
      {data?.notes && (
        <Card>
          <CardContent className="pt-6 space-y-2 text-xs text-muted-foreground">
            <p className="flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.notes.estimateSource}</span>
            </p>
            <p className="pl-6">{data.notes.smallJobs}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

