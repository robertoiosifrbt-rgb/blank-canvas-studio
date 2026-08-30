import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { getDashboard, GetDashboardOutputType, getActionCentre, GetActionCentreOutputType } from '@/lib/endpoints';
import { fmt } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CalendarCheck, CheckCircle, XCircle, RefreshCw, UserMinus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DateField from '@/components/shared/DateField';
/**
 * 🔴 §47 „Mobile/PWA performance" (Sesiunea 154) — GRAFICUL SE ÎNCARCĂ SEPARAT, ȘI E MĂSURAT.
 *
 * ⛔ Importat direct, `ExpenseChart` trăgea **toată biblioteca de grafice** (recharts) în bucata
 * Dashboard-ului: **379 kB** înainte, pentru un singur grafic cu bare. ⚠️ Dashboard-ul e **primul
 * ecran după autentificare**, deci pe un telefon fiecare intrare în aplicație plătea biblioteca aia
 * înainte să apară vreo cifră.
 *
 * ✅ Cu `lazy`, cifrele se văd imediat, iar graficul — care e oricum **sub linia de plutire** — vine
 * după. ⚠️ Nimic nu se pierde: e același grafic, doar că nu mai stă în drumul primei priviri.
 *
 * ⛔ **Nu e „code splitting" pus peste tot din reflex**: restul ecranului e mic, iar despărțirea lui
 * ar adăuga cereri fără să scurteze nimic. Bucata asta a fost aleasă fiindcă a fost **măsurată**.
 */
const ExpenseChart = lazy(() => import('./ExpenseChart'));
import ReceiptScanner from './ReceiptScanner';
import QuickActions from './DashboardQuickActions';
import MoneyCard from './DashboardMoneyCard';
import ActionCards from './DashboardActionCards';
import DashboardSkeleton from './DashboardSkeleton';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { validateDateRange as sharedValidateDateRange } from '@/lib/validation';
import { readChoice, writeChoice } from '@/lib/rememberedChoice';

/**
 * Sesiunea 28 (owner request: "vreau sa umbli un pic la dashboard... e cam
 * amestecata"). What was wrong, and what this layout does instead:
 *
 * 1. TWELVE equal-weight tiles in two identical grids. "Total Income" had the
 *    same prominence as "NI Reserve (9%)", so nothing told you where to look.
 *    Now: the eight money figures are ONE card that reads as a sentence —
 *    income minus expenses is profit, profit minus reserves is what you can
 *    actually spend. Available Cash is the big number because it answers the
 *    question you actually open this page with.
 * 2. PERIOD CONFUSION. The period selector changes the money figures but does
 *    nothing to the job counts (today/upcoming are always "right now"), yet
 *    they sat in matching grids directly below each other. They are now in a
 *    separate block, labelled as live, so the filter's scope is unambiguous.
 * 3. QUICK ACTIONS WERE LAST. The five things done most often were furthest
 *    from where the page opens. Moved directly under the header.
 * 4. COLOUR SOUP. Eight colours (purple NI, sky, violet, orange) with no
 *    system. Now four, each meaning one thing: emerald = money in,
 *    rose = money out, amber = set aside, orange = someone owes you.
 *
 * Data fetching, timeout/sequence protection and every error, stale and retry
 * path are unchanged from the previous version (ACHU-107/108/109) — this is a
 * presentation change only.
 */

const periods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'taxYear', label: 'This Tax Year' },
  { value: 'allTime', label: 'All Time' },
  { value: 'custom', label: 'Custom Date Range' },
];

/**
 * §37 „Saved dashboard preferences" — PERIOADA se ține minte, pe dispozitiv.
 *
 * 🔴 **De ce merită:** biroul se uită aproape mereu la aceeași fereastră de timp, iar până acum
 * ecranul se deschidea pe „This Month" și cineva care lucrează pe trimestru o schimba **la fiecare
 * deschidere**. ⚠️ Pe dispozitiv, nu pe cont, exact ca tema (`useTheme.ts`): laptopul de birou și
 * telefonul pot avea pe drept obiceiuri diferite. ⛔ Iar valoarea nu spune nimic despre nimeni — e
 * numele unei perioade — deci nu intră sub hotărârea de la §22 care ține ciornele în `sessionStorage`.
 *
 * ─── ⛔ „custom" NU SE ȚINE MINTE, și asta e jumătatea cinstită ──────────────
 * Un interval propriu e **două date**, nu o alegere. 🔴 Ținut minte doar ca „custom", ecranul s-ar
 * deschide pe un interval GOL, fără nicio cifră, arătând ca o pagină ruptă. ⚠️ Iar ținute minte și
 * datele, ar arăta o fereastră de acum o lună **ca și cum ar fi cea de acum** — exact „PERIOD
 * CONFUSION" din capul fișierului, doar mutată în timp. ✅ Deci se cade pe cea implicită, iar omul
 * vede în selector ce se arată.
 */
const PERIOD_KEY = 'achu:dashboard-period';
/** ⚠️ Fără „custom": vezi mai sus. Lista rămâne DERIVATĂ din `periods`, ca să nu fie a doua listă. */
const REMEMBERED_PERIODS = periods.map(p => p.value).filter(v => v !== 'custom');
const DEFAULT_PERIOD = 'month';

export default function Dashboard() {
  // ACHU-107/108/109: Two independent tracked requests — timeout + sequence protection
  const { data, loading: dashLoading, error: dashError, stale: dashStale, updatedAt: dashUpdatedAt, fire: fireDash } =
    useTrackedRequest<GetDashboardOutputType>({ timeoutMs: 30000 });
  const { data: actions, loading: actionsLoading, error: actionsError, stale: actionsStale, updatedAt: actionsUpdatedAt, fire: fireActions } =
    useTrackedRequest<GetActionCentreOutputType>({ timeoutMs: 15000 });

  /** Perioada citită la montare — ținută separat fiindcă prima cerere trebuie s-o folosească pe EA. */
  const [mountPeriod] = useState(() => readChoice(PERIOD_KEY, REMEMBERED_PERIODS, DEFAULT_PERIOD));
  const [period, setPeriod] = useState(mountPeriod);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [dateError, setDateError] = useState('');
  const nav = useNavigate();

  // Derived for JSX compatibility
  const retrying = dashLoading;

  // ACHU-107: Always fires — no loadingRef guard, latest-request-wins
  const loadDashboard = useCallback((p: string, sd?: string, ed?: string) => {
    fireDash(() => getDashboard({ period: p, startDate: sd, endDate: ed }));
  }, [fireDash]);

  // ACHU-109: No stale closure — hook manages state internally
  const refreshActions = useCallback(() => {
    fireActions(() => getActionCentre({}));
  }, [fireActions]);

  /**
   * 🔴 **Prima cerere trebuie să ceară CE ARATĂ SELECTORUL.** ⛔ Aici scria `loadDashboard('month')`,
   * scris de mână — iar cu perioada ținută minte, aceea devenea al doilea adevăr: selectorul ar fi
   * spus „This Quarter" și cifrele de dedesubt ar fi fost ale lunii, fără nimic pe ecran care să
   * arate dezacordul. ⚠️ Exact „PERIOD CONFUSION" din capul fișierului, dar mai rău: acolo omul
   * schimbase filtrul, aici nu atinsese nimic.
   *
   * ⚠️ **Folosește `mountPeriod`, nu `period`:** cu starea de acum în lista de dependențe, cererea
   * s-ar fi refăcut la fiecare schimbare — încă o dată peste cea pe care o face deja
   * `handlePeriodChange`. ⛔ Iar la montare nu poate fi „custom": aceea nu se ține minte.
   */
  useEffect(() => { loadDashboard(mountPeriod); }, [loadDashboard, mountPeriod]);
  useEffect(() => { refreshActions(); }, [refreshActions]);

  // Auto-refresh action centre on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refreshActions();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refreshActions]);

  // ACHU-107: Period change always triggers — no guard blocks it
  const handlePeriodChange = (v: string) => {
    setPeriod(v);
    // ⚠️ Se scrie doar ce se poate reciti întreg — „custom" nu, vezi comentariul de la `PERIOD_KEY`.
    if (v !== 'custom') { writeChoice(PERIOD_KEY, v); loadDashboard(v); }
  };

  // ACHU-078: Shared date range validator (same rules as backend)
  const validateDateRange = (sd: string, ed: string): string | null => sharedValidateDateRange(sd, ed);

  const handleCustomApply = () => {
    const err = validateDateRange(startDate, endDate);
    if (err) { setDateError(err); return; }
    setDateError('');
    loadDashboard('custom', startDate, endDate);
  };

  const handleRetry = () => loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);

  const handleFullRefresh = () => {
    loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);
    refreshActions();
  };

  const refreshAfterOperation = () => {
    loadDashboard(period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined);
    refreshActions();
  };

  // Show skeleton when no data and no error (initial / loading)
  if (!data && !dashError) return <DashboardSkeleton />;

  // Show error card when no data available
  if (!data) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive/60" />
            <p className="text-muted-foreground">{dashError || 'Unable to load dashboard data. Please try again.'}</p>
            <Button variant="outline" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying…' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const periodLabel = period === 'custom'
    ? (startDate && endDate ? `${startDate} → ${endDate}` : 'Custom range')
    : periods.find(p => p.value === period)?.label ?? '';

  const liveCounts = [
    { label: 'Jobs Today', value: data.jobsToday, icon: CalendarDays },
    { label: 'Upcoming', value: data.upcomingJobs, icon: CalendarCheck },
    { label: 'Completed', value: data.completedJobs, icon: CheckCircle },
    { label: 'Cancelled', value: data.cancelledJobs, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2 items-center flex-wrap">
          {/**
            * 🆕 §37 (Sesiunea 154) — „citit la HH:MM", lângă butonul de reîmprospătare.
            *
            * 🔴 **Marcajul e al ultimului răspuns REUȘIT** (`useTrackedRequest`), nu al randării: la
            * o eroare cifrele se păstrează și se marchează „stale", iar întrebarea omului devine
            * exact „vechi de cât?". ⚠️ Cifrele de mai jos și numărătorile din „Needs attention" vin
            * din **două** cereri, deci fiecare își poartă propria oră — un singur marcaj pentru tot
            * ecranul ar fi mințit despre jumătate din el.
            */}
          {dashUpdatedAt && (
            <span className="text-xs text-muted-foreground tabular-nums">
              read {dashUpdatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleFullRefresh} disabled={retrying || actionsLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${(retrying || actionsLoading) ? 'animate-spin' : ''}`} />Refresh All
          </Button>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]" aria-label="Period shown"><SelectValue /></SelectTrigger>
            <SelectContent>{periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {period === 'custom' && (
            <>
              <DateField className="w-[140px]" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-sm text-muted-foreground">to</span>
              <DateField className="w-[140px]" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <Button size="sm" onClick={handleCustomApply}>Apply</Button>
            </>
          )}
        </div>
      </div>

      {dateError && period === 'custom' && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{dateError}</p>
        </div>
      )}

      {dashError && data && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${dashStale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${dashStale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${dashStale ? 'text-amber-800' : 'text-destructive'}`}>
            {dashError}{dashStale && <span className="ml-1 text-xs font-medium">(showing cached data)</span>}
          </p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={retrying}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {!data.settingsConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Financial settings not configured. <button className="underline font-medium" onClick={() => nav('/admin/financial-settings')}>Configure now</button>
          </CardContent>
        </Card>
      )}

      {/* ── Quick actions — moved to the top, where the page opens ── */}
      <QuickActions onScan={() => setScannerOpen(true)} nav={nav} />

      {/* ── The money story for the selected period ───────────── */}
      <MoneyCard data={data} periodLabel={periodLabel} nav={nav} />

      {/* ── Live counts — deliberately NOT period-filtered ────── */}
      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="text-sm font-semibold">Right now</h3>
          <span className="text-xs text-muted-foreground">live — not affected by the period filter above</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {liveCounts.map(c => (
            <Card key={c.label}><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">{c.value}</p>
            </CardContent></Card>
          ))}
        </div>

        {/**
          * 🆕 §37 (Sesiunea 154) — CINE LIPSEȘTE AZI.
          *
          * ⛔ **Nu scrie „disponibili", și nu e o scăpare.** Disponibilitatea are nevoie de zilele și
          * orele pe care le lucrează normal fiecare om — §13, niciun rând construit. Fără el,
          * „disponibili: 7" ar însemna „la șapte oameni n-am găsit nicio absență", iar cineva care nu
          * lucrează joi ar fi numărat printre ei. 🔴 Biroul ar programa după cifra aceea.
          *
          * ✅ Deci se spune ce se știe: **cine lipsește, și de ce.** Cu NUMELE — un dispecer nu poate
          * face nimic cu „doi oameni lipsesc".
          *
          * ⚠️ În blocul live, deci **neatins de filtrul de perioadă**, ca celelalte numărători de aici.
          */}
        {data.offToday && (
          <Card className="mt-3">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserMinus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">
                  Off today{data.offToday.people > 0 ? ` — ${data.offToday.people}` : ''}
                </span>
              </div>
              {data.offToday.people === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is on leave, off sick or on family leave today.</p>
              ) : (
                <ul className="text-sm space-y-0.5">
                  {data.offToday.rows.map((r: { cleanerId: string; kind: string; label: string; name: string }, i: number) => (
                    <li key={`${r.cleanerId}-${r.kind}-${i}`}>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground"> — {r.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Needs attention ──────────────────────────────────── */}
      <ActionCards
        actions={actions}
        error={actionsError}
        loading={actionsLoading}
        stale={actionsStale}
        updatedAt={actionsUpdatedAt}
        onRetry={refreshActions}
        nav={nav}
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Expenses for {periodLabel}: {fmt(data.periodExpenses)}</CardTitle></CardHeader>
        <CardContent>
          {/**
            * ⚠️ Locul păstrat, nu gol: fără o înălțime, cardul ar sări de la o linie la 300px când
            * sosește graficul — iar dacă tocmai atinseseși ceva de sub el, ai fi atins altceva.
            */}
          <Suspense fallback={<div className="h-[300px] animate-pulse rounded bg-muted/40" aria-hidden="true" />}>
            <ExpenseChart data={data.expensesByCategory} />
          </Suspense>
        </CardContent>
      </Card>

      <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onSaved={() => { setScannerOpen(false); refreshAfterOperation(); }} />
    </div>
  );
}

