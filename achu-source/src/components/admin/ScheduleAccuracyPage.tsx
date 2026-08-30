import { useEffect, useState, useCallback } from 'react';
import { getScheduleAccuracy, exportScheduleAccuracy, type ScheduleAccuracyResponse } from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, CalendarClock, Download } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { ScheduleFlagBadges } from './ScheduleFlagBadges';
import EmptyTableRow from '../shared/EmptyTableRow';

/**
 * §38 „Scheduled versus actual duration" (Sesiunea 154) — SE ȚINE CALENDARUL DE CE SCRIE ÎN EL?
 *
 * ─── 🔴 Ce întrebare e asta, și de ce e alt ecran ───────────────────────────
 * Fereastra scrisă pe vizită (09:00–11:00) față de cât a ținut de fapt, după marcajele aplicației.
 * Întrebarea e a biroului care programează: *„dacă scriu două ore, se termină în două ore?"*.
 *
 * ⛔ **NU e „Sold time vs worked time".** Acela compară minute de **muncă** — cele din care s-a
 * făcut prețul — cu orele pontate, și răspunde la *„vindem prea ieftin?"*. Aici e timp **scurs**: o
 * vizită în doi e 60 de minute scurse și 120 de minute de muncă. 🔴 Amestecul dă o abatere 100%
 * greșită pe fiecare vizită cu doi oameni, **arătând perfect rezonabilă** — de asta sunt două ecrane.
 *
 * ─── ⚠️ Pe SERVICIU întâi, ca la celălalt raport ────────────────────────────
 * O vizită se lungește din motive pe care nimeni nu le repetă — trafic, o țeavă spartă, un client
 * vorbăreț. Un **serviciu** care depășește la fiecare vizită e o fereastră scrisă greșit, iar aceea
 * costă capacitate în calendar la fiecare programare.
 *
 * ⛔ **Nimeni nu e plătit din cifra asta**, și ecranul o spune: orele plătite sunt pontajele aprobate.
 */

/** Chihlimbar peste, verde sub, mut aproape de plan. ⛔ Roșu nicăieri: nu e o acuzație. */
function toneFor(percent: number | null): string {
  if (percent === null) return 'text-muted-foreground';
  if (percent >= 15) return 'text-amber-700 dark:text-amber-400';
  if (percent <= -15) return 'text-emerald-700 dark:text-emerald-400';
  return 'text-muted-foreground';
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/** Minute → „1h 30m", ca pe vizită. ⚠️ Minutele rămân în fișier; omul citește ore. */
function hm(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`;
}

export default function ScheduleAccuracyPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * ⚠️ **Tiparul casei pentru încărcare** (`useTrackedRequest`), ca la „Money owed" și la restul
   * ecranelor de birou: plafon de timp, un răspuns vechi sosit după unul nou e respins, iar datele
   * anterioare se păstrează la eroare. ⛔ O încărcare scrisă de mână aici ar fi fost încă o variantă.
   */
  const req = useTrackedRequest<ScheduleAccuracyResponse>({ timeoutMs: 30000 });
  // ⚠️ `fire` destructurat, nu `req.fire`: altfel `exhaustive-deps` cere tot obiectul ca dependență.
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getScheduleAccuracy({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);

  // Serverul cade pe luna curentă, care e întrebarea pe care o pune lumea.
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const error = req.error;
  const loading = req.loading;

  const download = async () => {
    setBusy(true);
    try {
      await exportScheduleAccuracy({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  const cov = data?.coverage;
  const nothingComparable = cov != null && cov.comparable === 0;
  const thin = cov != null && cov.visits > 0 && cov.comparable > 0 && cov.comparable / cov.visits < 0.5;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<CalendarClock className="h-5 w-5" />}
        title="Booked window vs actual"
        description="Whether a job written as two hours takes two hours. Elapsed time — not the hours anybody is paid for."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="sa-from">From</Label>
            <DateField id="sa-from" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sa-to">To</Label>
            <DateField id="sa-to" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || nothingComparable}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the current month. A job counts in the month it was WORKED. Only jobs marked
            Completed are read — a cancelled one is not a cleaning that happened.
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

      {/* ─── Acoperirea, ÎNAINTEA oricărei cifre ────────────────────────── */}
      {cov && (
        <Card className={`p-3 ${nothingComparable ? 'border-amber-500/50 bg-amber-500/5' : thin ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-border'}`}>
          <p className={`flex gap-2 text-xs ${nothingComparable || thin ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
            {nothingComparable || thin
              ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{cov.note}</span>
          </p>
        </Card>
      )}

      {data && !nothingComparable && (
        <>
          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Jobs compared</p>
                <p className="text-2xl font-semibold">{data.totals.comparableVisits}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Booked</p>
                <p className="text-2xl font-semibold">{hm(data.totals.plannedMinutes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual</p>
                <p className="text-2xl font-semibold">{hm(data.totals.actualMinutes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Finished inside the window</p>
                {/* ⚠️ Cifra pe care biroul o vrea de fapt, iar cea de sub ea o pune în context. */}
                <p className="text-2xl font-semibold">{data.totals.withinWindow}</p>
                <p className={`text-xs ${toneFor(data.totals.variancePercent)}`}>
                  {data.totals.variancePercent == null ? '—' : `${signed(data.totals.variancePercent)}% overall`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">By service</h2>
              <p className="text-xs text-muted-foreground">
                Furthest from plan first, in either direction. One late job is noise; a service that never fits its
                window is a window written wrong — and that costs a slot in the calendar every time it is booked.
              </p>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Service</th>
                      <th scope="col" className="py-2 pr-3">Jobs</th>
                      <th scope="col" className="py-2 pr-3">Booked</th>
                      <th scope="col" className="py-2 pr-3">Actual</th>
                      <th scope="col" className="py-2">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byService.length === 0 ? <EmptyTableRow colSpan={5}>No finished jobs with both a booked and an actual time in this period.</EmptyTableRow> : data.byService.map(s => (
                      <tr key={s.service} className="border-b last:border-0">
                        <td className="py-2 pr-3">{s.service}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {s.jobCount}
                          {s.jobsBelowThreshold > 0 && (
                            <span className="text-xs text-muted-foreground" title="Short jobs are counted in the minutes but kept out of the percentage">
                              {' '}({s.jobsBelowThreshold} short)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{hm(s.plannedMinutes)}</td>
                        <td className="py-2 pr-3 tabular-nums">{hm(s.actualMinutes)}</td>
                        <td className={`py-2 tabular-nums ${toneFor(s.variancePercent)}`}>
                          {hm(s.varianceMinutes)}
                          {s.variancePercent != null && <span className="text-xs"> ({signed(s.variancePercent)}%)</span>}
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
              <h2 className="font-medium">Furthest from plan</h2>
              <p className="text-xs text-muted-foreground">
                Both directions: a job booked for two hours and finished in forty minutes is either a window written
                too wide or a clean done in a hurry. Both are worth a look.
              </p>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Job</th>
                      <th scope="col" className="py-2 pr-3">Date</th>
                      <th scope="col" className="py-2 pr-3">Customer</th>
                      <th scope="col" className="py-2 pr-3">Booked</th>
                      <th scope="col" className="py-2 pr-3">Actual</th>
                      <th scope="col" className="py-2">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.furthestFromPlan.length === 0 ? <EmptyTableRow colSpan={6}>Nothing ran far enough from its plan to be worth listing.</EmptyTableRow> : data.furthestFromPlan.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">#{r.reference}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">{r.customerName}</td>
                        <td className="py-2 pr-3 tabular-nums">{hm(r.plannedMinutes)}</td>
                        <td className="py-2 pr-3 tabular-nums">{hm(r.actualMinutes)}</td>
                        <td className={`py-2 tabular-nums ${toneFor(r.variancePercent)}`}>
                          {hm(r.varianceMinutes)}
                          {r.variancePercent != null && <span className="text-xs"> ({signed(r.variancePercent)}%)</span>}
                          <ScheduleFlagBadges flags={r.flags} className="ml-1.5 align-middle" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ⚠️ Limitele se SPUN. Sunt trimise de server, deci nu se pot învechi aici. */}
          <Card>
            <CardContent className="pt-6 space-y-1.5 text-xs text-muted-foreground">
              <p>{data.notes.whatThisIs}</p>
              <p>{data.notes.notPay}</p>
              <p>{data.notes.smallVisits}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

