import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertTriangle, Info, Users, Sparkles, MapPin, Repeat, Wrench, Home, Clock,
  Target, Globe, UsersRound, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DateField from '@/components/shared/DateField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getProfitability, type ProfitabilityResponse, type ProfitabilityGroup } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { ukToday, monthStart, monthEnd, addDays, quarterStart, quarterEnd, ukTaxYear } from '@/lib/ukDate';
import RefreshButton from '../shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

/**
 * Sesiunea 33 (backlog 26 — Profitability și management accounting).
 *
 * ─── The design problem here is not layout, it is honesty ────────────────
 * Labour is the largest cost in a cleaning business and this system has no pay
 * rate anywhere, so labour is only known when somebody recorded it as a
 * `Staff Payment` expense against a job. A page that showed "88% margin" without
 * saying so would be actively harmful: someone would use it to set a price and
 * lose money on every visit.
 *
 * So the labour caveat is **the first thing on the page**, in a bordered panel,
 * above every number — not a footnote, not a tooltip, not grey small print at the
 * bottom. When no wages are recorded at all it is amber and says the figures
 * exclude labour in those words, and says how to fix it.
 *
 * The word "profit" appears nowhere as a figure. Everything is "contribution",
 * which is what it actually is.
 */

type PeriodPreset = 'month' | 'lastMonth' | 'quarter' | 'taxYear' | 'custom';

function marginTone(percent: number | null): string {
  if (percent === null) return 'text-muted-foreground';
  if (percent < 0) return 'text-red-600 dark:text-red-400';
  if (percent < 20) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function GroupTable({ title, icon: Icon, groups, note }: {
  title: string;
  icon: typeof Users;
  groups: ProfitabilityGroup[];
  note?: string | null;
}) {
  if (!groups?.length) return null;
  return (
    /**
     * 🔴 `min-w-0` NU e decorativ, și lipsa lui a fost defectul raportat de Roberto pe telefon
     * (poze, 15/08/2026): pagina se plimba lateral, iar titlurile cardurilor ieșeau din ecran.
     *
     * De ce: cardul ăsta e copil de **grilă** (`grid gap-3 lg:grid-cols-2`, mai jos), iar un
     * element de grilă are `min-width: auto` — adică refuză să scadă sub lățimea minimă a
     * conținutului. Conținutul lui e tabelul de `min-w-[460px]`, deci coloana cerea 460px pe un
     * ecran de 390px, și **toată pagina** creștea după ea. Containerul cu `overflow-x-auto` de
     * mai jos nu ajuta: el derulează ce e ÎNĂUNTRU, dar nu îl lasă pe părinte să se îngusteze.
     *
     * ⚠️ **Măsurat, nu dedus** (`AGENT_RULES` §10, lecția ACHU-415): Chromium la 390px lățime,
     * `documentElement.scrollWidth` era **502** înainte și **390** după. Ambele cifre citite din
     * browser, cu datele întoarse de ruta reală.
     */
    <Card className="min-w-0 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />{title}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{note}</p>}
      {/* Scrolls inside its own container so the page never scrolls sideways. */}
      <div tabIndex={0} className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-1 pr-2 text-left font-medium">Name</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Jobs</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Revenue</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Cost</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Contribution</th>
              <th scope="col" className="py-1 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.key} className="border-b border-border/50">
                <td className="py-1 pr-2 max-w-[160px] truncate">
                  {g.label}
                  {/* Per-group labour coverage: a group whose wages were recorded
                      looks worse than one whose were not, and that difference is
                      bookkeeping, not performance. */}
                  {g.jobsWithLabourRecorded === 0 && g.jobCount > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(no wages)</span>
                  )}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">{g.jobCount}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fmt(g.revenue)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fmt(g.directCost)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fmt(g.contribution)}</td>
                <td className={`py-1 text-right tabular-nums font-medium ${marginTone(g.contributionMarginPercent)}`}>
                  {g.contributionMarginPercent === null ? '—' : `${g.contributionMarginPercent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ProfitabilityPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [from, setFrom] = useState(monthStart(ukToday()));
  const [to, setTo] = useState(monthEnd(ukToday()));
  const [threshold, setThreshold] = useState(20);
  const [data, setData] = useState<ProfitabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    const today = ukToday();
    if (p === 'month') { setFrom(monthStart(today)); setTo(monthEnd(today)); }
    else if (p === 'lastMonth') {
      const lastMonthDay = addDays(monthStart(today), -1);
      setFrom(monthStart(lastMonthDay)); setTo(monthEnd(lastMonthDay));
    }
    else if (p === 'quarter') { setFrom(quarterStart(today)); setTo(quarterEnd(today)); }
    else if (p === 'taxYear') {
      // The UK tax year (6 April – 5 April) is what the owner's accountant asks
      // for, and ukDate already knows it — no reason to make him work it out.
      const ty = ukTaxYear(today);
      setFrom(ty.start); setTo(ty.end);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getProfitability({ from, to, marginThreshold: threshold }));
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the figures.');
    } finally {
      setLoading(false);
    }
  }, [from, to, threshold]);

  useEffect(() => { load(); }, [load]);

  const noLabourAtAll = data?.labourCoverage?.jobsWithLabour === 0 && data?.labourCoverage?.totalJobs > 0;
  const partialLabour = data?.labourCoverage?.percent !== null
    && data?.labourCoverage?.percent > 0
    && data?.labourCoverage?.percent < 80;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 min-w-0">
        <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
        <h1 className="text-xl font-semibold truncate">Where the money goes</h1>
      </div>

      {/* ─── Period ───────────────────────────────────────────────────── */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="profitabil-period" className="text-xs">Period</Label>
            <Select value={preset} onValueChange={v => applyPreset(v as PeriodPreset)}>
              <SelectTrigger id="profitabil-period" className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="lastMonth">Last month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
                <SelectItem value="taxYear">This tax year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <>
              <div><Label htmlFor="profitabil-from" className="text-xs">From</Label><DateField id="profitabil-from" className="h-9" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><Label htmlFor="profitabil-to" className="text-xs">To</Label><DateField id="profitabil-to" className="h-9" value={to} onChange={e => setTo(e.target.value)} /></div>
            </>
          )}
          <div>
            <Label htmlFor="profitabil-flag-jobs-under" className="text-xs">Flag jobs under</Label>
            <div className="flex items-center gap-1">
              <Input id="profitabil-flag-jobs-under" type="number" className="h-9 w-20" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <RefreshButton onRefresh={load} />
        </div>
      </Card>

      {/* ─── The caveat, FIRST ────────────────────────────────────────── */}
      {/* Above every number, deliberately. A margin figure that silently excludes
          the biggest cost is worse than no figure, because it gets used. */}
      {data?.labourCoverage?.caveat && (
        <Card className={`p-3 ${
          noLabourAtAll ? 'border-amber-500/50 bg-amber-500/5'
          : partialLabour ? 'border-amber-500/30 bg-amber-500/[0.03]'
          : 'border-border'
        }`}>
          <p className={`flex gap-2 text-xs ${noLabourAtAll || partialLabour ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
            {noLabourAtAll || partialLabour
              ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{data.labourCoverage.caveat}</span>
          </p>

          {/* ACHU-269. Where the labour came from. Shown only once the timesheet is
              actually being used for something, so a business that records wages as
              expenses never sees a line about a mechanism it does not use. */}
          {data.labourCoverage.jobsFromTimesheet > 0 && (
            <p className="mt-2 pl-6 text-xs text-muted-foreground">
              {data.labourCoverage.jobsFromTimesheet} job{data.labourCoverage.jobsFromTimesheet === 1 ? '' : 's'} costed
              from approved timesheet hours
              {data.labourCoverage.jobsFromExpenses > 0 && <>, {data.labourCoverage.jobsFromExpenses} from a Staff Payment expense</>}.
            </p>
          )}

          {/* A SEPARATE panel, not appended to the caveat. The caveat is about how
              much to trust the margin; this is a specific thing to go and fix, and
              merging the two buries the actionable half. */}
          {data.labourCoverage.dataWarning && (
            <p className="mt-2 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{data.labourCoverage.dataWarning}</span>
            </p>
          )}
        </Card>
      )}

      {loading && !data ? (
        <LoadingSkeleton heights={['h-24', 'h-40', 'h-40']} label="Working it out…" />
      ) : data?.totals?.jobCount === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">No completed jobs in this period</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only jobs marked Completed (or cancelled but still charged for) count as earnings — the same rule the Dashboard uses.
          </p>
        </Card>
      ) : data ? (
        <>
          {/* ─── Headline figures ───────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Charged for {data.totals.jobCount} job{data.totals.jobCount === 1 ? '' : 's'}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{fmt(data.totals.revenue)}</p>
              {/* Both questions, side by side: what was billed vs what arrived. */}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(data.totals.netCollected)} collected</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Job costs</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{fmt(data.totals.directCost)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fmt(data.totals.labourCost)} wages · {fmt(data.totals.materialsCost)} supplies
              </p>
            </Card>
            <Card className="p-3">
              {/* "Contribution", never "profit". */}
              <p className="text-xs text-muted-foreground">Left after job costs</p>
              <p className={`mt-0.5 text-xl font-semibold tabular-nums ${marginTone(data.totals.contributionMarginPercent)}`}>
                {fmt(data.totals.contribution)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {data.totals.contributionMarginPercent === null ? '—' : `${data.totals.contributionMarginPercent}% of what you charged`}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">After running costs</p>
              <p className={`mt-0.5 text-xl font-semibold tabular-nums ${data.totals.afterOverheads < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {fmt(data.totals.afterOverheads)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(data.overheads.total)} not tied to a job</p>
            </Card>
          </div>

          {/* ─── Jobs worth looking at ──────────────────────────────── */}
          {data.lowMargin.jobs.length > 0 && (
            <Card className="border-red-500/40 bg-red-500/5 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {data.lowMargin.jobs.length} job{data.lowMargin.jobs.length === 1 ? '' : 's'} under {data.lowMargin.thresholdPercent}%
              </p>
              <div tabIndex={0} className="mt-1.5 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-xs">
                  <tbody>
                    {data.lowMargin.jobs.slice(0, 10).map(j => (
                      <tr key={j.id} className="border-b border-red-500/20">
                        <td className="py-1 pr-2 tabular-nums text-red-700/80 dark:text-red-300/80">{j.date}</td>
                        <td className="py-1 pr-2 max-w-[140px] truncate">{j.customerName}</td>
                        <td className="py-1 pr-2 truncate text-red-700/80 dark:text-red-300/80">{j.service}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmt(j.revenue)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">−{fmt(j.directCost)}</td>
                        <td className={`py-1 text-right tabular-nums font-medium ${marginTone(j.contributionMarginPercent)}`}>
                          {j.contributionMarginPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.lowMargin.jobs.length > 10 && (
                <p className="mt-1 text-[11px] text-red-700/70 dark:text-red-300/70">and {data.lowMargin.jobs.length - 10} more</p>
              )}
            </Card>
          )}

          {data.lowMargin.jobsWithNoPrice > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {/* Named, not silently excluded: a job with no price is a data
                    problem, and it would otherwise rank as infinitely bad. */}
                <strong>{data.lowMargin.jobsWithNoPrice} job{data.lowMargin.jobsWithNoPrice === 1 ? '' : 's'}</strong> in this period have no price recorded, so they are left out of the margins above. Worth checking they were meant to be free.
              </p>
            </Card>
          )}

          {/**
            * 🆕 §26 „Profit per labour hour" (Sesiunea 154) — CÂT RĂMÂNE DINTR-O ORĂ DE MUNCĂ.
            *
            * 🔴 **Sub marjă, dar înaintea desfacerilor**, fiindcă e cifra care hotărăște ce se vinde
            * mai departe: două vizite cu aceeași marjă nu sunt aceeași afacere dacă una ține de două
            * ori mai mult — ora e resursa rară, nu lira.
            *
            * ⚠️ **Propoziția de acoperire stă lângă cifră**, nu sub tabel: o medie pe trei vizite din
            * nouăzeci arată identic cu una pe toate. ⛔ Iar „—" în loc de „0 £/oră" când nu există ore
            * aprobate: o împărțire la zero nu e un randament.
            */}
          {data.perLabourHour && (
            <Card className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-medium">What an hour of work leaves</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Per approved hour</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.perLabourHour.contributionPerHour === null
                      ? '—'
                      : fmt(data.perLabourHour.contributionPerHour)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hours behind it</p>
                  <p className="text-2xl font-semibold tabular-nums">{data.perLabourHour.hours}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Left after direct costs</p>
                  <p className="text-2xl font-semibold tabular-nums">{fmt(data.perLabourHour.contribution)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{data.perLabourHour.coverageNote}</p>

              {data.perLabourHour.byService.length > 0 && (
                <div tabIndex={0} className="overflow-x-auto pt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3">Service</th>
                        <th scope="col" className="py-2 pr-3">Jobs with hours</th>
                        <th scope="col" className="py-2 pr-3 text-right">Hours</th>
                        <th scope="col" className="py-2 text-right">Per hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ⚠️ Cel mai slab primul — lista se citește ca să găsești ce nu merită vândut. */}
                      {data.perLabourHour.byService.map(g => (
                        <tr key={g.service} className="border-b last:border-0">
                          <td className="py-2 pr-3">{g.service}</td>
                          <td className="py-2 pr-3 tabular-nums">{g.jobsWithHours}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{g.hours}</td>
                          <td className="py-2 text-right tabular-nums">
                            {g.contributionPerHour === null ? '—' : fmt(g.contributionPerHour)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ⛔ Ce NU e cifra, spus de server ca să nu se poată învechi aici. */}
              <p className="text-xs text-muted-foreground">{data.perLabourHour.notes.notARate}</p>
              <p className="text-xs text-muted-foreground">{data.perLabourHour.notes.notPerPerson}</p>
            </Card>
          )}

          {/**
            * 🆕 §26 „Estimated versus actual profit" (Sesiunea 154) — A LĂSAT CÂT CREDEAM LA PREȚ?
            *
            * 🔴 **Sub «pe oră», fiindcă e cifra care schimbă un PREȚ**, nu una care descrie o lună:
            * un serviciu care iese sistematic sub estimare e vândut greșit, iar asta se repară o
            * dată, la listă de prețuri, nu vizită cu vizită.
            *
            * ⚠️ **Semnul e scris în culoare, nu doar în cifră** — roșu numai când s-a pierdut față
            * de preț. ⛔ Iar „sub estimare" NU e verde-triumfal: poate să fi fost o vizită făcută în
            * grabă, sau ore neaprobate încă (`notes.notASaving`, venită de la server).
            */}
          {data.estimatedVsActual.jobCount > 0 && (
            <Card className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-medium">Against the price we sold</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Expected to be left</p>
                  <p className="text-2xl font-semibold tabular-nums">{fmt(data.estimatedVsActual.estimatedContribution)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Actually left</p>
                  <p className="text-2xl font-semibold tabular-nums">{fmt(data.estimatedVsActual.actualContribution)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className={`text-2xl font-semibold tabular-nums ${data.estimatedVsActual.varianceContribution < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {fmt(data.estimatedVsActual.varianceContribution)}
                    {data.estimatedVsActual.variancePercent !== null && (
                      <span className="ml-1 text-sm font-normal">({data.estimatedVsActual.variancePercent}%)</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {/* Timpul e cauza, deci stă lângă bani: minutele vândute față de cele lucrate. */}
                Sold as {data.estimatedVsActual.estimatedMinutes} min of work, took {data.estimatedVsActual.actualMinutes} min
                {data.estimatedVsActual.varianceMinutes !== 0 && ` (${data.estimatedVsActual.varianceMinutes > 0 ? '+' : ''}${data.estimatedVsActual.varianceMinutes} min)`}.
              </p>
              <p className="text-xs text-muted-foreground">{data.estimatedVsActual.coverageNote}</p>

              {data.estimatedVsActual.byService.length > 0 && (
                <div tabIndex={0} className="overflow-x-auto pt-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3">Service</th>
                        <th scope="col" className="py-2 pr-3">Jobs</th>
                        <th scope="col" className="py-2 pr-3 text-right">Expected</th>
                        <th scope="col" className="py-2 pr-3 text-right">Actual</th>
                        <th scope="col" className="py-2 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ⚠️ Cel mai prost primul — lista se citește ca să găsești ce e vândut greșit. */}
                      {data.estimatedVsActual.byService.map(g => (
                        <tr key={g.service} className="border-b last:border-0">
                          <td className="py-2 pr-3">{g.service}</td>
                          <td className="py-2 pr-3 tabular-nums">{g.jobCount}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmt(g.estimatedContribution)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmt(g.actualContribution)}</td>
                          <td className={`py-2 text-right tabular-nums ${g.varianceContribution < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {fmt(g.varianceContribution)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ⛔ Ce NU e cifra, spus de server ca să nu se poată învechi aici. */}
              <p className="text-xs text-muted-foreground">{data.estimatedVsActual.notes.whichEstimate}</p>
              <p className="text-xs text-muted-foreground">{data.estimatedVsActual.notes.notASaving}</p>
            </Card>
          )}

          {/* ─── Breakdowns ─────────────────────────────────────────── */}
          <div className="grid gap-3 lg:grid-cols-2">
            <GroupTable title="By customer" icon={Users} groups={data.breakdown.byCustomer} />
            <GroupTable title="By service" icon={Wrench} groups={data.breakdown.byService} />
            <GroupTable title="By area" icon={MapPin} groups={data.breakdown.byArea} />
            {/* 🆕 §26 (Sesiunea 154) — pe CASĂ: un client cu trei case poate avea una care nu merită. */}
            <GroupTable title="By property" icon={Home} groups={data.breakdown.byProperty} />
            {/* 🆕 §26 (Sesiunea 154) — de unde au venit banii buni; sursa e a CERERII de ofertă. */}
            <GroupTable title="By booking source" icon={Globe} groups={data.breakdown.byBookingSource} />
            <GroupTable title="Recurring vs one-off" icon={Repeat} groups={data.breakdown.byRecurring} />
            {/**
              * 🆕 §26 „Profit by team" A (Sesiunea 154) — pe FORMAȚIE, adică pe cine a mers împreună.
              * ✅ Deasupra celui pe curățător, dinadins: rândurile astea **se adună** la totalul
              * perioadei, iar cele de dedesubt nu (o vizită cu doi oameni e numărată la fiecare).
              */}
            {/**
              * 🆕 §26 „Profit by team" B (Sesiunea 154) — ECHIPA FIXĂ.
              * ⚠️ Deasupra formației, fiindcă e desfacerea cerută întâi; ⛔ `note` apare doar când
              * chiar sunt vizite mixte, ca avertismentul să nu devină zgomot de fundal.
              */}
            <GroupTable
              title="By team"
              icon={Shield}
              groups={data.breakdown.byTeam.groups}
              note={data.breakdown.byTeam.note}
            />
            <GroupTable
              title="Who worked together"
              icon={UsersRound}
              groups={data.breakdown.byCrew.groups}
              note={data.breakdown.byCrew.note}
            />
            <GroupTable
              title="By cleaner"
              icon={Sparkles}
              groups={data.breakdown.byCleaner.groups}
              note={data.breakdown.byCleaner.note}
            />
          </div>

          {/* ─── Running costs ──────────────────────────────────────── */}
          {data.overheads.byCategory.length > 0 && (
            <Card className="p-3">
              <p className="text-sm font-medium">Running costs not tied to a job</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fmt(data.overheads.total)}
                {data.overheads.percentOfRevenue !== null && ` — ${data.overheads.percentOfRevenue}% of what you charged`}.
                {' '}{data.overheads.note}
              </p>
              <ul className="mt-2 space-y-0.5">
                {data.overheads.byCategory.map(c => (
                  <li key={c.category} className="flex justify-between text-xs">
                    <span>{c.category}</span>
                    <span className="tabular-nums">{fmt(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.jobsTruncated > 0 && (
            <p className="text-center text-[11px] text-muted-foreground">
              Showing the {data.jobs.length} worst-margin jobs; {data.jobsTruncated} more in this period.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

