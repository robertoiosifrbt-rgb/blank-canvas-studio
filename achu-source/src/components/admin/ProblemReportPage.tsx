import { useEffect, useState, useCallback } from 'react';
import {
  getProblemReport, exportProblemReport, type ProblemReportResponse, type ProblemCountGroup,
} from '@/lib/reportEndpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, Download, TriangleAlert } from 'lucide-react';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { fmt } from '@/lib/format';

/**
 * §38 „Complaint report / Incident report / Re-clean report" (Sesiunea 155) — CE A MERS PROST.
 *
 * ─── 🔴 Un ecran, trei numărători, NICIUN total peste ele ────────────────────
 * O canapea pătată poate fi toate trei rândurile (clientul se plânge · firma deschide dosar · se
 * reface curățenia); o cheie pierdută pe drumul spre casă e **doar** incident, clientul nu află
 * niciodată. ⛔ Un total peste cele trei ar număra unele evenimente de trei ori și altele o dată —
 * deci nu există niciun câmp „total" pe ecran, iar propoziția care spune de ce stă **sus**, înaintea
 * cifrelor.
 *
 * ─── 🔴 Ce e cifra care se poate ACȚIONA, și nu e numărul de reclamații ──────
 * **De ce s-a întâmplat** (`byCause`) e primul tabel din secțiunea de reclamații, nu al treilea:
 * *„opt reclamații de calitate"* nu spune ce e de schimbat, iar *„opt, șase din grabă"* spune. ⚠️ Iar
 * lângă el stă câte s-au închis **fără** cauză scrisă: un tabel de cauze arată complet exact când nu e.
 *
 * ⛔ **Nicio cifră pe curățător, nicăieri** — aceeași linie ca la raportul de calitate: un număr despre
 * un om, arătat biroului, e o afirmație despre el.
 */

/** ⛔ „—", nu „0": fără nimic închis nu există „cât durează", iar 0 ar arăta ca „instant". */
const days = (v: number | null) => (v === null ? '—' : `${v}`);

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

/**
 * Un tabel de numărători.
 *
 * ⚠️ **Tabelul gol SPUNE că e gol** (§48): un antet peste nimic se citește ca un ecran care nu s-a
 * încărcat. ⛔ Iar `aria-label` e titlul, nu „table": pe un cititor de ecran cele patru tabele ale
 * ecranului ar fi altfel de nedeosebit.
 */
function CountTable({ title, groups, nameHeader, empty }: {
  title: string; groups: ProblemCountGroup[]; nameHeader: string; empty: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      <div tabIndex={0} className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={title}>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3">{nameHeader}</th>
              <th scope="col" className="py-2 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={2} className="py-3 text-muted-foreground">{empty}</td></tr>
            )}
            {groups.map(g => (
              <tr key={g.value} className="border-b last:border-0">
                <td className="py-2 pr-3">{g.label}</td>
                <td className="py-2 text-right tabular-nums">{g.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** ⚠️ O propoziție de avertisment, în aceeași formă de fiecare dată. */
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-500">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

export default function ProblemReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  /** ⚠️ Tiparul casei (`useTrackedRequest`), ca la celelalte rapoarte. */
  const req = useTrackedRequest<ProblemReportResponse>({ timeoutMs: 30000 });
  const { fire } = req;
  const load = useCallback(() => {
    fire(() => getProblemReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) }));
  }, [fire, from, to]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const nothing = data ? data.complaints.total + data.incidents.total + data.reCleans.total === 0 : true;

  const download = async () => {
    setBusy(true);
    try {
      await exportProblemReport({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not export the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<TriangleAlert className="h-5 w-5" />}
        title="What went wrong"
        description="Complaints, incidents and re-cleans over a period — how often, why, and how each one ended."
        actions={<RefreshButton onRefresh={load} />}
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="wr-from">From</Label>
            <DateField id="wr-from" value={from} onChange={ev => setFrom(ev.target.value)} />
          </div>
          <div>
            <Label htmlFor="wr-to">To</Label>
            <DateField id="wr-to" value={to} onChange={ev => setTo(ev.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={load} disabled={req.loading}>Apply</Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void download()} disabled={busy || nothing}>
              <Download className="h-3.5 w-3.5 mr-1" />{busy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          {/*
            ⚠️ Perioada implicită e de ȘASE luni, nu luna curentă ca la rapoartele de bani: două
            reclamații nu sunt un tipar, iar un ecran care se deschide pe ele invită exact concluzia
            pe care raportul de calitate refuză să o lase (`QA_MIN_SAMPLE`).
          */}
          <p className="sm:col-span-4 text-xs text-muted-foreground">
            Leave both blank for the last six months. {data?.notes.dates}
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
            <div className="space-y-1.5">
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.notes.threeStreams}</span>
              </p>
              <p className="text-xs text-muted-foreground pl-6">{data.notes.recordedOnly}</p>
            </div>
          </Card>

          <Card>
            <CardContent className="pt-6 grid gap-4 sm:grid-cols-3">
              <Tile
                label="Complaints raised"
                value={String(data.complaints.total)}
                note={`${data.complaints.open} still open`}
              />
              <Tile
                label="Incidents that happened"
                value={String(data.incidents.total)}
                note={`${data.incidents.open} still open`}
              />
              <Tile
                label="Re-cleans raised"
                value={String(data.reCleans.total)}
                note={data.reCleans.caughtByUs.percent === null
                  ? 'None in this period'
                  : `${pct(data.reCleans.caughtByUs.percent)} spotted by us first`}
              />
            </CardContent>
          </Card>

          {/* ─── RECLAMAȚIILE ─────────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Complaints</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <Tile
                  label="Past the reply target"
                  value={String(data.complaints.overdueOpen)}
                  note="Open, and we said 2 working days"
                  alarm={data.complaints.overdueOpen > 0}
                />
                <Tile label="Answered late" value={String(data.complaints.answeredLate)} note="Already closed" />
                <Tile
                  label="Days to close"
                  value={days(data.complaints.medianDaysToClose)}
                  note={data.complaints.medianDaysToClose === null
                    ? 'Nothing closed in this period'
                    : 'Half closed faster than this'}
                />
                <Tile
                  label="Led to a re-clean"
                  value={String(data.complaints.ledToReClean)}
                  note={`Of ${data.complaints.total} raised`}
                />
              </div>

              {/* 🔴 Cauza PRIMA: e singura coloană din care se poate schimba ceva. */}
              <CountTable
                title="Why it happened"
                groups={data.complaints.byCause}
                nameHeader="Cause"
                empty="No cause has been recorded on any complaint in this period."
              />
              <CountTable
                title="What it was about"
                groups={data.complaints.byCategory}
                nameHeader="Category"
                empty="No complaints in this period."
              />
              <CountTable
                title="What we did"
                groups={data.complaints.byOutcome}
                nameHeader="Outcome"
                empty="No outcome has been recorded on any complaint in this period."
              />
              <CountTable
                title="How serious"
                groups={data.complaints.bySeverity}
                nameHeader="Severity"
                empty="No complaints in this period."
              />

              {data.complaints.closedWithoutCause > 0 && (
                <Warn>
                  {data.complaints.closedWithoutCause} closed without a cause recorded — those are missing from
                  “Why it happened” above.
                </Warn>
              )}
              {data.complaints.closedWithoutOutcome > 0 && (
                <Warn>
                  {data.complaints.closedWithoutOutcome} closed without an outcome recorded — those are missing from
                  “What we did” above.
                </Warn>
              )}
              <p className="text-xs text-muted-foreground">{data.notes.closureFields}</p>
            </CardContent>
          </Card>

          {/* ─── INCIDENTELE ──────────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Incidents</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <Tile
                  label="Open and possibly reportable"
                  value={String(data.incidents.openReportable)}
                  note="Injury, safeguarding, theft allegation"
                  alarm={data.incidents.openReportable > 0}
                />
                <Tile
                  label="Recorded as reported outside"
                  value={String(data.incidents.reportedExternally)}
                  note="Somebody ticked it"
                />
                <Tile
                  label="Cost written down"
                  value={fmt(data.incidents.cost.total)}
                  note={`On ${data.incidents.cost.recordedOn} of ${data.incidents.total} dossiers`}
                />
                <Tile
                  label="Days to close"
                  value={days(data.incidents.medianDaysToClose)}
                  note={data.incidents.medianDaysToClose === null
                    ? 'Nothing closed in this period'
                    : 'From when it was recorded'}
                />
              </div>

              <CountTable
                title="What kind"
                groups={data.incidents.byKind}
                nameHeader="Kind"
                empty="No incidents happened in this period."
              />
              <CountTable
                title="How serious"
                groups={data.incidents.bySeverity}
                nameHeader="Severity"
                empty="No incidents happened in this period."
              />

              {data.incidents.closedReportableWithoutRecord > 0 && (
                <Warn>
                  {data.incidents.closedReportableWithoutRecord} closed as possibly reportable with nothing written
                  about reporting it. That does not mean we got it wrong — it means nobody wrote that the question
                  was asked.
                </Warn>
              )}
              <p className="text-xs text-muted-foreground">{data.notes.incidentCost}</p>
            </CardContent>
          </Card>

          {/* ─── RE-CURĂȚENIILE ──────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="font-medium">Re-cleans</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Tile
                  label="We spotted it first"
                  value={pct(data.reCleans.caughtByUs.percent)}
                  note={`${data.reCleans.caughtByUs.count} of ${data.reCleans.total}`}
                />
                <Tile
                  label="Approved, no job booked"
                  value={String(data.reCleans.approvedWithoutJob)}
                  note="A promise nobody has put in the calendar"
                  alarm={data.reCleans.approvedWithoutJob > 0}
                />
                <Tile
                  label="Started from a complaint"
                  value={String(data.reCleans.fromComplaint)}
                  note="The rest we opened ourselves"
                />
              </div>

              <CountTable
                title="Who spotted it"
                groups={data.reCleans.bySource}
                nameHeader="Spotted by"
                empty="No re-cleans were raised in this period."
              />
              <CountTable
                title="Where it got to"
                groups={data.reCleans.byOutcome}
                nameHeader="Outcome"
                empty="No re-cleans were raised in this period."
              />
              <p className="text-xs text-muted-foreground">{data.notes.reCleanCost}</p>
            </CardContent>
          </Card>

          {/* ─── LUNĂ CU LUNĂ ────────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="font-medium">Month by month</h2>
              <div tabIndex={0} className="overflow-x-auto pt-1">
                <table className="w-full text-sm" aria-label="Month by month">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Month</th>
                      <th scope="col" className="py-2 pr-3 text-right">Complaints</th>
                      <th scope="col" className="py-2 pr-3 text-right">Incidents</th>
                      <th scope="col" className="py-2 text-right">Re-cleans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-muted-foreground">No months in this period.</td></tr>
                    )}
                    {data.trend.map(p => (
                      <tr key={p.month} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{p.month}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.complaints}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.incidents}</td>
                        <td className="py-2 text-right tabular-nums">{p.reCleans}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* ⚠️ Fără rând de total, dinadins — vezi propoziția de sus. */}
              <p className="text-xs text-muted-foreground">{data.notes.dates}</p>
            </CardContent>
          </Card>

          {/* ⚠️ Limitele se SPUN, și vin de la server ca să nu se poată învechi aici. */}
          <Card>
            <CardContent className="pt-6 space-y-1.5 text-xs text-muted-foreground">
              <p>{data.notes.noPerCleaner}</p>
              <p>{data.notes.reportedExternally}</p>
              <p>{data.notes.recordedOnly}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

