import { useEffect, useState, useCallback } from 'react';
import {
  getJobsReport, exportJobsReport,
  type JobsReportResponse, type JobsCountGroup, type JobsServiceLine,
} from '@/lib/jobsReportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, Download, BarChart3 } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';

/**
 * §38 „Jobs report" (Sesiunea 155) — CE S-A ÎNTÂMPLAT CU MUNCA DIN PERIOADĂ.
 *
 * ─── 🔴 Cifra care se poate acționa: CE NU S-A ÎNTÂMPLAT ────────────────────
 * Anulările, și mai ales **„No access"** — cineva a plecat spre o casă și nu a putut intra: drumul e
 * făcut, ora din calendar e pierdută, clientul tot trebuie sunat. ⛔ Cele două stau **despărțite** pe
 * ecran fiindcă se repară altfel: una e o discuție despre calendar, cealaltă o cheie sau un cod.
 *
 * ⛔ **NICIUN BAN AICI, și e o alegere.** Un total lângă numărul de vizite ar fi fost al patrulea
 * răspuns la „cât am făcut", lângă profitabilitate, sumarul lunar și prima pagină — fiecare cu regula
 * lui. ⚠️ Ecranul o spune în cuvinte și trimite acolo.
 *
 * ⚠️ **Și spune ce NU poate ști:** de ce s-a anulat o vizită (nu există câmp de motiv) și cât ar fi
 * putut duce echipa (nimic nu consemnează cine e disponibil când). 🔴 Fără propoziția a doua, tabelul
 * pe zile ar fi citit ca o măsură de capacitate — și cineva ar fi hotărât angajări pe el.
 */

/** ⛔ „—", nu „0%": fără numitor nu există procent. */
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

function Tile({ label, value, note, alarm }: { label: string; value: string; note?: string; alarm?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums${alarm ? ' text-destructive' : ''}`}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** ⚠️ Tabelul gol SPUNE că e gol (§48): un antet peste nimic arată ca un ecran care nu s-a încărcat. */
function CountTable({ title, groups, nameHeader, empty }: {
  title: string; groups: JobsCountGroup[]; nameHeader: string; empty: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      <div tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={title}>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3">{nameHeader}</th>
              <th scope="col" className="py-2 text-right">Jobs</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={2} className="py-3 text-muted-foreground">{empty}</td></tr>
            )}
            {groups.map(g => (
              <tr key={g.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{g.key}</td>
                <td className="py-2 text-right tabular-nums">{g.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** ⚠️ Pe serviciu sunt patru coloane, nu una: totalul singur nu spune care serviciu cade cel mai des. */
function ServiceTable({ lines }: { lines: JobsServiceLine[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">By service</p>
      <div tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="By service">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3">Service</th>
              <th scope="col" className="py-2 pr-3 text-right">Jobs</th>
              <th scope="col" className="py-2 pr-3 text-right">Completed</th>
              <th scope="col" className="py-2 pr-3 text-right">Did not happen</th>
              <th scope="col" className="py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-muted-foreground">No jobs were booked in this period.</td></tr>
            )}
            {lines.map(s => (
              <tr key={s.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{s.key}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.total}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.completed}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.didNotHappen}</td>
                <td className="py-2 text-right tabular-nums">{pct(s.percentDidNotHappen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function JobsReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<JobsReportResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getJobsReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const nothing = data ? data.bookedWork + data.enquiries === 0 : true;

  const download = async () => {
    setBusy(true);
    try {
      await exportJobsReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Jobs report"
        description="How much work was in the diary over a period, and what happened to it."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="jr-from">From</Label>
            <DateField id="jr-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="jr-to">To</Label>
            <DateField id="jr-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || nothing}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the current month. {data?.notes.period}
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
          {/* ─── Ce NU e ecranul, ÎNAINTEA cifrelor ────────────────────────── */}
          <Card className="p-3">
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.notes.noMoney}</span>
            </p>
          </Card>

          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
              <Tile
                label="Jobs in the diary"
                value={String(data.bookedWork)}
                note={`${data.enquiries} enquiries, counted apart`}
              />
              <Tile label="Completed" value={String(data.outcome.completed)} />
              <Tile
                label="Did not happen"
                value={pct(data.didNotHappen.percent)}
                note={`${data.didNotHappen.count} cancelled or no access`}
                alarm={data.didNotHappen.count > 0}
              />
              <Tile
                label="Nobody could get in"
                value={String(data.outcome.noAccess)}
                note={data.noAccess.percent === null ? 'No jobs in this period' : `${pct(data.noAccess.percent)} of the diary`}
                alarm={data.outcome.noAccess > 0}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">How it ended</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <Tile label="Completed" value={String(data.outcome.completed)} />
                <Tile label="Cancelled" value={String(data.outcome.cancelled)} />
                <Tile label="No access" value={String(data.outcome.noAccess)} />
                <Tile
                  label="Still open"
                  value={String(data.outcome.stillOpen)}
                  note="Neither finished nor called off"
                />
              </div>
              <CountTable
                title="By status"
                groups={data.byStatus}
                nameHeader="Status"
                empty="No jobs and no enquiries in this period."
              />
              {/* ⚠️ Limita se spune LÂNGĂ cifra pe care o limitează, nu doar la sfârșit. */}
              <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.notes.noCancelReason}</span>
              </p>
              <p className="text-xs text-muted-foreground">{data.notes.noAccess}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">What kind of work</h2>
              <ServiceTable lines={data.byService} />
              <CountTable
                title="How it was arranged"
                groups={data.byArrangement}
                nameHeader="Arrangement"
                empty="No jobs were booked in this period."
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Which days the work falls on</h2>
              <CountTable
                title="By day of the week"
                groups={data.byWeekday}
                nameHeader="Day"
                empty="No jobs were booked in this period."
              />
              {/* 🔴 Fără propoziția asta, tabelul de sus se citește ca o măsură de capacitate. */}
              <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.notes.capacity}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Who did it</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Tile
                  label="No cleaner recorded"
                  value={String(data.cleaner.noneRecorded)}
                  note="Of the whole diary"
                />
                <Tile
                  label="Completed with nobody recorded"
                  value={String(data.cleaner.completedWithoutCleaner)}
                  note="The job happened — who did it was not written down"
                  alarm={data.cleaner.completedWithoutCleaner > 0}
                />
              </div>
              <p className="text-xs text-muted-foreground">{data.notes.cleanerRecorded}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Month by month</h2>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm" aria-label="Month by month">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Month</th>
                      <th scope="col" className="py-2 pr-3 text-right">In the diary</th>
                      <th scope="col" className="py-2 pr-3 text-right">Completed</th>
                      <th scope="col" className="py-2 text-right">Did not happen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-muted-foreground">No months in this period.</td></tr>
                    )}
                    {data.trend.map(t => (
                      <tr key={t.month} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{t.month}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{t.total}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{t.completed}</td>
                        <td className="py-2 text-right tabular-nums">{t.didNotHappen}</td>
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
              <p>{data.notes.enquiries}</p>
              <p>{data.notes.noMoney}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

