import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getActionCentre, GetActionCentreOutputType, convertQuoteRequest } from '@/lib/endpoints';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import { Search, RefreshCw, AlertCircle, PoundSterling, ChevronRight, ArrowLeft, CalendarDays, FileText } from 'lucide-react';

import {
  type SectionKey, SECTION_META, SECTION_COLORS, ACTION_SECTION_KEYS,
  CARD_ROW_1, CARD_ROW_3, SINGLE_CARD_ROWS,
} from './actionCentreSections';
/**
 * 🔴 ACHU-777 (Sesiunea 154) — unde duce un rând. ⛔ A ieșit din pagină fiindcă ea e peste
 * plafonul de mărime și **nu are voie să crească** (`AGENT_RULES` §7.3), iar reparația adăuga
 * șase feluri de rând. ⚠️ Ce a ieșit e chiar partea care nu e comportament: o hartă de drumuri.
 */
import { actionCentreRecordPath } from './actionCentreOpenPath';
// §48 (Sesiunea 154) - sectiunea vizitelor incheiate, extrasa: vezi nota din fisierul ei.
import { CompletedJobsSummaryCard, CompletedJobsView } from './ActionCentreCompletedJobs';
import HistoryCapNote from '@/components/shared/HistoryCapNote';

type ActionData = GetActionCentreOutputType;
type ActionItem = ActionData['jobs']['items'][0];
type FutureJob = ActionData['futureJobs']['items'][0];

const SCROLL_KEY = 'ac-scroll';
const SEARCH_KEY = 'ac-search';

// ─── Overview card ──────────────────────────────────────────────────

type ActionSectionData = ActionData['jobs'];

function SectionCard({ sectionKey, data, active, onClick }: {
  sectionKey: SectionKey; data: ActionSectionData; active: boolean; onClick: () => void;
}) {
  const meta = SECTION_META[sectionKey];
  const Icon = meta.icon;
  const count = data.totalCount;
  const hasAmount = data.totalAmount !== undefined && data.totalAmount > 0;
  const colors = SECTION_COLORS[sectionKey];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all min-h-[80px] ${
        active
          ? `${colors.activeBg} ${colors.border} shadow-sm`
          : count > 0
            ? `${colors.bg} ${colors.border} hover:shadow-sm`
            : 'border-border/50 bg-muted/30 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${count > 0 ? colors.icon : 'bg-muted text-muted-foreground'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">{meta.label}</h3>
            <span className={`text-lg font-bold tabular-nums shrink-0 rounded-full px-2 min-w-[2rem] text-center ${count > 0 ? colors.badge : 'text-muted-foreground'}`}>
              {count > 999 ? '999+' : count}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
          {hasAmount && (
            <p className={`text-xs font-medium mt-1 ${colors.text}`}>
              {fmt(data.totalAmount!)} outstanding
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Category pill ──────────────────────────────────────────────────

function CategoryPill({ label, count, amount, active, onClick, sectionKey }: {
  label: string; count: number; amount?: number; active: boolean; onClick: () => void; sectionKey?: SectionKey;
}) {
  const c = sectionKey ? SECTION_COLORS[sectionKey] : null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors whitespace-nowrap min-h-[36px] ${
        active && c
          ? `${c.activeBg} ${c.border} ${c.text} font-medium`
          : active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border hover:bg-muted'
      }`}
    >
      <span>{label}</span>
      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${active && c ? c.badge : ''}`}>
        {count}
      </Badge>
      {amount !== undefined && amount > 0 && (
        <span className={`text-[10px] ${active ? 'opacity-80' : 'text-muted-foreground'}`}>
          · {fmt(amount)}
        </span>
      )}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function ActionCentrePage() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const actReq = useTrackedRequest<ActionData>({ timeoutMs: 45000 });
  const data = actReq.data;
  const error = actReq.error;
  const refreshing = actReq.loading;
  const [search, setSearch] = useState('');
  const pendingScrollRef = useRef<number | null>(null);
  const scrollRestoredRef = useRef(false);

  const section = (sp.get('section') as SectionKey) || '';
  const filter = sp.get('filter') || '';

  // ACHU-055: Restore search text from sessionStorage on mount
  useEffect(() => {
    const savedSearch = sessionStorage.getItem(SEARCH_KEY);
    if (savedSearch) {
      setSearch(savedSearch);
      sessionStorage.removeItem(SEARCH_KEY);
    }
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (savedScroll) {
      pendingScrollRef.current = parseInt(savedScroll, 10);
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, []);

  const [conversionSummary, setConversionSummary] = useState<string | null>(null);

  const load = useCallback(() => {
    actReq.fire(async () => {
      // ACHU-094: Auto-convert — do NOT suppress errors
      try {
        const convResult = await convertQuoteRequest({});
        const parts: string[] = [];
        if (convResult.converted > 0) parts.push(`${convResult.converted} converted`);
        const resumedCount = convResult.items?.filter(i => i.outcome === 'resumed').length ?? 0;
        if (resumedCount > 0) parts.push(`${resumedCount} resumed`);
        if (convResult.failed > 0) parts.push(`${convResult.failed} failed`);
        if (convResult.skipped > 0) parts.push(`${convResult.skipped} skipped`);
        if (convResult.remaining > 0) parts.push(`${convResult.remaining} remaining`);
        if (parts.length > 0) {
          setConversionSummary(`Conversion: ${parts.join(', ')}`);
        } else {
          setConversionSummary(null);
        }
        if (convResult.errors && convResult.errors.length > 0) {
          setConversionSummary(prev =>
            (prev ? prev + '. ' : '') + `Errors: ${convResult.errors!.slice(0, 3).join('; ')}${convResult.errors!.length > 3 ? ` (+${convResult.errors!.length - 3} more)` : ''}`
          );
        }
      } catch (convErr) {
        setConversionSummary(`Conversion error: ${errMsg(convErr) || 'Unknown error'}`);
      }
      return await getActionCentre({});
    });
  }, [actReq.fire]);

  useEffect(() => { load(); }, [load]);

  // ACHU-055: Restore scroll position after data loads
  useEffect(() => {
    if (!data || scrollRestoredRef.current) return;
    if (pendingScrollRef.current !== null) {
      const scrollTarget = pendingScrollRef.current;
      pendingScrollRef.current = null;
      scrollRestoredRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollTarget);
        });
      });
    }
  }, [data]);

  const setSection = (s: SectionKey | '') => {
    const next = new URLSearchParams(sp);
    if (s) next.set('section', s); else next.delete('section');
    next.delete('filter');
    setSp(next, { replace: true });
    setSearch('');
  };

  const setFilter = (f: string) => {
    const next = new URLSearchParams(sp);
    if (f) next.set('filter', f); else next.delete('filter');
    setSp(next, { replace: true });
  };

  // ACHU-452: the quick-summary pills used to call setSection(k) then
  // setTimeout(() => setFilter(c.key), 0) — two separate setSp calls, the
  // second reading `sp` from the closure captured at click time, which is
  // stale by the time the timeout's macrotask runs (it never observes the
  // section change the first call just made). The second call landed a
  // URLSearchParams with the filter but WITHOUT the section, silently
  // undoing the navigation — the pill looked clickable and did nothing.
  const setSectionAndFilter = (s: SectionKey, f: string) => {
    const next = new URLSearchParams(sp);
    if (s) next.set('section', s); else next.delete('section');
    if (f) next.set('filter', f); else next.delete('filter');
    setSp(next, { replace: true });
    setSearch('');
  };

  const openRecord = (item: ActionItem) => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    if (search) sessionStorage.setItem(SEARCH_KEY, search);

    const returnTo = encodeURIComponent(`/admin/action-centre?${sp.toString()}`);
    const path = actionCentreRecordPath(item.entityType, item.entityId, returnTo);
    if (path) nav(path);
  };

  // ─── Loading state ───
  if (!data && !error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ─── Full error state ───
  if (!data && error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Action Centre</h2>
        <Card><CardContent className="p-8 text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/60" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => load()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Retrying…' : 'Retry'}
          </Button>
        </CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  // Total across action sections (not futureJobs)
  /**
   * ⚠️ `?.` și `?? 0`, iar motivul e măsurat: la §36 (Sesiunea 142) o secțiune NOUĂ a intrat în
   * `ACTION_SECTION_KEYS`, iar suma a căzut cu TypeError pe orice răspuns care nu o conținea —
   * și ecranul întreg rămânea gol, nu doar cifra. 🔴 Un răspuns fără o secțiune e o stare reală:
   * un backend încă nedeployat, sau o secțiune scoasă cândva. Suma trebuie să spună o cifră mai
   * mică, nu să șteargă pagina.
   */
  const grandTotal = ACTION_SECTION_KEYS.reduce((s, k) => s + ((data[k] as ActionSectionData | undefined)?.totalCount ?? 0), 0);

  // ─── Overview mode (no section selected) ───
  if (!section) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Back to the dashboard" title="Back to the dashboard" onClick={() => nav('/admin')} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">Action Centre</h2>
              <p className="text-sm text-muted-foreground">{grandTotal} item{grandTotal !== 1 ? 's' : ''} need attention</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {error && data && (
          <div className={`rounded-lg p-3 flex items-center gap-2 ${actReq.stale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
            <AlertCircle className={`h-4 w-4 shrink-0 ${actReq.stale ? 'text-amber-600' : 'text-destructive'}`} />
            <p className={`text-sm flex-1 ${actReq.stale ? 'text-amber-800' : 'text-destructive'}`}>{error}{actReq.stale ? ' — showing cached data' : ''}</p>
            <Button variant="ghost" size="sm" onClick={() => load()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Retry
            </Button>
          </div>
        )}

        {conversionSummary && (
          <div className={`rounded-lg p-3 flex items-center gap-2 ${
            conversionSummary.includes('error') || conversionSummary.includes('failed') || conversionSummary.includes('Error')
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-emerald-50 border border-emerald-200'
          }`}>
            <FileText className={`h-4 w-4 shrink-0 ${
              conversionSummary.includes('error') || conversionSummary.includes('failed') || conversionSummary.includes('Error')
                ? 'text-amber-600' : 'text-emerald-600'
            }`} />
            <p className="text-sm flex-1">{conversionSummary}</p>
            <button onClick={() => setConversionSummary(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
        )}

        {/* ACHU-135: Reordered card grid — Row 1: Jobs, Money, Refunds */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CARD_ROW_1.map(k => (
            <SectionCard key={k} sectionKey={k} data={data[k] as ActionSectionData} active={false} onClick={() => setSection(k)} />
          ))}
        </div>

        {/* Row 2: Cancelled & Exceptions, Future Jobs, Completed Jobs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SectionCard sectionKey="cancelled" data={data.cancelled} active={false} onClick={() => setSection('cancelled')} />
          <FutureJobsSummaryCard data={data.futureJobs} onClick={() => setSection('futureJobs')} />
          <CompletedJobsSummaryCard data={data.completedJobs} onClick={() => setSection('completedJobs')} />
        </div>

        {/* Row 3: Prepared Accounts, Expenses & Receipts, Quote Conversions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CARD_ROW_3.map(k => (
            <SectionCard key={k} sectionKey={k} data={data[k] as ActionSectionData} active={false} onClick={() => setSection(k)} />
          ))}
        </div>

        {/**
          * Rândurile de un singur card (ore de aprobat, cereri de clienți, note mici neurmărite,
          * contracte fără vizite). ⚠️ **Iterate, nu copiate:** fiecare avea blocul lui aproape
          * identic, iar al patrulea ar fi cerut încă șapte rânduri într-un fișier care nu are voie
          * să crească. Motivul fiecărui rând stă lângă definiția lui, în `actionCentreSections.ts`.
          *
          * ⛔ Regula comună: **doar când are ceva în el.** Un card permanent gol învață ochiul să
          * sară peste locul în care apare, cândva, un lucru urgent.
          */}
        {SINGLE_CARD_ROWS.map((row, i) => (
          row.some(k => (data[k] as ActionSectionData | undefined)?.totalCount) ? (
            <div key={i} className="grid grid-cols-1 gap-3">
              {row.map(k => (
                <SectionCard key={k} sectionKey={k} data={data[k] as ActionSectionData} active={false} onClick={() => setSection(k)} />
              ))}
            </div>
          ) : null
        ))}

        {/* Quick summary of categories per section */}
        {([...ACTION_SECTION_KEYS, 'preparedAccounts'] as SectionKey[]).filter(k => data[k] && (data[k] as ActionSectionData).totalCount > 0).map(k => {
          const sd = data[k] as ActionSectionData;
          const meta = SECTION_META[k];
          const colors = SECTION_COLORS[k];
          return (
            <div key={k} className="space-y-2">
              <button
                onClick={() => setSection(k)}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors group ${colors.text}`}
              >
                <meta.icon className="h-4 w-4" />
                {meta.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>{sd.totalCount}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {sd.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-6">
                  {sd.categories.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSectionAndFilter(k, c.key)}
                      className="text-[11px] px-2 py-1 rounded-md bg-muted/60 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * ⚠️ **Aceeași funcție pentru amândouă coborârile** (vizite viitoare · vizite terminate) — era
   * scrisă de două ori, literă cu literă. 🔴 Ce face: ține minte unde era pagina și ce s-a căutat,
   * apoi duce la vizită **cu drumul de întoarcere în adresă**, ca butonul „înapoi" al ecranului de
   * vizite să aducă omul exact unde era, nu în capul listei.
   *
   * ⛔ Extrasă în felia care avea nevoie de spațiu (ACHU-781), nu ca felie separată — regula casei.
   */
  const openJobFromDrilldown = (id: string) => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    if (search) sessionStorage.setItem(SEARCH_KEY, search);
    const returnTo = encodeURIComponent(`/admin/action-centre?${sp.toString()}`);
    nav(`/admin/jobs?id=${id}&returnTo=${returnTo}`);
  };

  /** ⚠️ Cele cinci lucruri identice pe amândouă coborârile — scrise o dată, ca să nu se despartă tăcut. */
  const drilldownProps = {
    onBack: () => setSection(''), onRefresh: () => load(), refreshing, error, openJob: openJobFromDrilldown,
  };

  // ─── Drilldown: Future Jobs ───
  if (section === 'futureJobs') {
    return (
      <FutureJobsView
        data={data.futureJobs}
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={(f: string) => {
          const next = new URLSearchParams(sp);
          if (f) next.set('filter', f); else next.delete('filter');
          setSp(next, { replace: true });
        }}
        {...drilldownProps}
      />
    );
  }

  // ─── Drilldown: Completed Jobs ───
  if (section === 'completedJobs') {
    return (
      <CompletedJobsView
        data={data.completedJobs}
        search={search}
        setSearch={setSearch}
        {...drilldownProps}
      />
    );
  }

  // ─── Drilldown: section selected ───
  const sectionData = data[section] as ActionSectionData;
  const categories = sectionData.categories;
  const meta = SECTION_META[section];
  const colors = SECTION_COLORS[section];
  let items = sectionData.items;

  if (filter) {
    items = items.filter(i => {
      if (i.reasonCode === filter) return true;
      if (filter === 'unpaid' && (i.reasonCode === 'unpaid' || i.reasonCode === 'unpaid-overdue')) return true;
      if (filter === 'partial' && (i.reasonCode === 'partial' || i.reasonCode === 'partial-overdue')) return true;
      if (filter === 'overdue' && i.reasonCode.endsWith('-overdue')) return true;
      if (filter === 'total') return true;
      return false;
    });
  }

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.customerName ?? '').toLowerCase().includes(q) ||
      i.reason.toLowerCase().includes(q) ||
      (i.supplier ?? '').toLowerCase().includes(q)
    );
  }

  items = [...items].sort((a, b) => {
    if (section === 'money' || section === 'jobs') return (a.date ?? '').localeCompare(b.date ?? '');
    return (b.date ?? '').localeCompare(a.date ?? '');
  });

  const activeFilterLabel = filter
    ? categories.find(c => c.key === filter)?.label ?? 'Filtered'
    : 'All';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" aria-label="Back to all sections" title="Back to all sections" onClick={() => setSection('')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              <meta.icon className={`h-5 w-5 shrink-0 ${colors.text}`} />
              <span className="truncate">{meta.label}</span>
              <Badge variant="secondary">{sectionData.totalCount}</Badge>
            </h2>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={refreshing} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && data && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${actReq.stale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${actReq.stale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${actReq.stale ? 'text-amber-800' : 'text-destructive'}`}>{error}{actReq.stale ? ' — showing cached data' : ''}</p>
          <Button variant="ghost" size="sm" onClick={() => load()} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Retry
          </Button>
        </div>
      )}

      {/* Money summary banner */}
      {section === 'money' && sectionData.totalAmount !== undefined && sectionData.totalAmount > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-4 text-sm">
          <PoundSterling className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-medium">Total Outstanding</p>
            <p className="text-2xl font-bold text-primary">{fmt(sectionData.totalAmount)}</p>
          </div>
          <span className="text-muted-foreground ml-auto">across {sectionData.totalCount} job{sectionData.totalCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CategoryPill label="All" count={sectionData.totalCount} active={!filter} onClick={() => setFilter('')} sectionKey={section} />
          {categories.map(c => (
            <CategoryPill key={c.key} label={c.label} count={c.count} amount={c.amount} active={filter === c.key} onClick={() => setFilter(c.key)} sectionKey={section} />
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search within results" placeholder="Search within results…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        Showing {items.length} of {sectionData.totalCount} item{sectionData.totalCount !== 1 ? 's' : ''}
        {filter ? ` in ${activeFilterLabel}` : ''}
      </p>

      {/* Items */}
      {items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {search ? 'No matching items found.' : 'No items in this category — everything looks good!'}
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <div tabIndex={0} className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th scope="col" className="text-left p-3 font-medium">Record</th>
                  <th scope="col" className="text-left p-3 font-medium">{section === 'expenses' ? 'Supplier' : 'Customer'}</th>
                  <th scope="col" className="text-left p-3 font-medium">Date</th>
                  <th scope="col" className="text-left p-3 font-medium">Status</th>
                  {(section === 'money') && (
                    <>
                      <th scope="col" className="text-right p-3 font-medium">Charged</th>
                      <th scope="col" className="text-right p-3 font-medium">Outstanding</th>
                    </>
                  )}
                  {(section === 'refunds' || section === 'expenses') && (
                    <th scope="col" className="text-right p-3 font-medium">Amount</th>
                  )}
                  <th scope="col" className="text-left p-3 font-medium">Reason</th>
                  <th scope="col" className="text-left p-3 font-medium">Action</th>
                  <th scope="col" className="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    className={`border-t border-border hover:bg-muted/30 cursor-pointer ${item.voidStatus === 'Voided' ? 'opacity-60' : ''}`}
                    onClick={() => openRecord(item)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openRecord(item)}
                  >
                    <td className="p-3 font-medium text-xs whitespace-nowrap">{item.label}</td>
                    <td className="p-3">{item.customerName ?? item.supplier ?? item.cleanerName ?? '—'}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(item.date ?? undefined)}</td>
                    <td className="p-3"><StatusBadge status={item.status ?? item.paymentStatus ?? undefined} /></td>
                    {section === 'money' && (
                      <>
                        <td className="p-3 text-right whitespace-nowrap">{item.amountCharged != null ? fmt(item.amountCharged) : '—'}</td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">{fmt(item.outstandingBalance ?? 0)}</td>
                      </>
                    )}
                    {(section === 'refunds' || section === 'expenses') && (
                      <td className="p-3 text-right whitespace-nowrap">{item.amount != null ? fmt(item.amount) : '—'}</td>
                    )}
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{item.reason}</td>
                    <td className="p-3 text-xs font-medium text-primary whitespace-nowrap">{item.suggestedAction}</td>
                    <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.map(item => (
              <Card
                key={item.id}
                className={`cursor-pointer active:shadow-md transition-shadow ${item.voidStatus === 'Voided' ? 'opacity-60' : ''}`}
                onClick={() => openRecord(item)}
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openRecord(item)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.customerName ?? item.supplier ?? ''}
                        {item.date ? ` · ${fmtDate(item.date)}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={item.status ?? item.paymentStatus ?? undefined} />
                    {item.outstandingBalance != null && item.outstandingBalance > 0 && (
                      <Badge variant="outline" className="text-[10px]">Owed: {fmt(item.outstandingBalance)}</Badge>
                    )}
                    {item.amount != null && (section === 'expenses' || section === 'refunds') && (
                      <Badge variant="outline" className="text-[10px]">{fmt(item.amount)}</Badge>
                    )}
                    {item.voidStatus === 'Voided' && (
                      <Badge variant="destructive" className="text-[10px]">Voided</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{item.reason}</p>
                  <p className="text-xs font-medium text-primary">{item.suggestedAction}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 🔴 ACHU-781 — istoricul (anulate, convertite) e plafonat, iar lista o SPUNE. Motivul: `HistoryCapNote`. */}
          <HistoryCapNote note={sectionData.historyNote} />
        </>
      )}
    </div>
  );
}

// ─── Completed Jobs Summary Card (ACHU-135) ────────────────────────

function FutureJobsSummaryCard({ data, onClick }: {
  data: ActionData['futureJobs']; onClick: () => void;
}) {
  const colors = SECTION_COLORS.futureJobs;
  const count = data.activeCount;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all min-h-[80px] ${
        count > 0
          ? `${colors.bg} ${colors.border} hover:shadow-sm`
          : 'border-border/50 bg-muted/30 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${count > 0 ? colors.icon : 'bg-muted text-muted-foreground'}`}>
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">Future Jobs</h3>
            <span className={`text-lg font-bold tabular-nums shrink-0 rounded-full px-2 min-w-[2rem] text-center ${count > 0 ? colors.badge : 'text-muted-foreground'}`}>
              {count > 999 ? '999+' : count}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">All jobs scheduled after today</p>
        </div>
      </div>
    </button>
  );
}

// ─── Future Jobs Detail View ────────────────────────────────────────

type FutureFilter = '' | 'active' | 'all' | 'tomorrow' | 'thisWeek' | 'unassigned';

function formatDateHeading(dateStr: string, tomorrowStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const formatted = fmtDate(dateStr);
  if (dateStr === tomorrowStr) return `Tomorrow — ${formatted}`;
  return `${dayName} — ${formatted}`;
}

function FutureJobsView({ data, search, setSearch, filter, setFilter, onBack, onRefresh, refreshing, openJob, error }: {
  data: ActionData['futureJobs'];
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (f: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  openJob: (id: string) => void;
  error: string | null;
}) {
  const colors = SECTION_COLORS.futureJobs;
  // ACHU-099: Closed statuses consistent with backend (Completed, Cancelled, No Access)
  const CLOSED = useMemo(() => new Set(['Completed', 'Cancelled', 'No Access']), []);
  const isActive = useCallback((j: FutureJob) => !CLOSED.has(j.status ?? ''), [CLOSED]);

  // Default to 'active' if no filter
  const activeFilter: FutureFilter = (filter as FutureFilter) || 'active';

  const filtered = useMemo(() => {
    let items = data.items;
    switch (activeFilter) {
      case 'active':
        items = items.filter(isActive);
        break;
      case 'tomorrow':
        // ACHU-099: Tomorrow excludes closed jobs
        items = items.filter(j => j.jobDate === data.tomorrowStr && isActive(j));
        break;
      case 'thisWeek':
        // ACHU-099: This Week excludes closed jobs
        items = items.filter(j => j.jobDate <= data.weekEndStr && isActive(j));
        break;
      case 'unassigned':
        // ACHU-099: Unassigned excludes closed jobs
        items = items.filter(j => j.unassigned && isActive(j));
        break;
      case 'all':
      default:
        break;
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(j =>
        String(j.jobId).toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        (j.service ?? '').toLowerCase().includes(q) ||
        (j.address ?? '').toLowerCase().includes(q) ||
        j.assignedCleanerNames.some(n => n.toLowerCase().includes(q)) ||
        (j.status ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [data.items, activeFilter, search, data.tomorrowStr, data.weekEndStr, isActive]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, FutureJob[]>();
    for (const j of filtered) {
      const key = j.jobDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // ACHU-099: Filter counts must match the lists they open
  const counts = useMemo(() => ({
    active: data.items.filter(isActive).length,
    all: data.items.length,
    tomorrow: data.items.filter(j => j.jobDate === data.tomorrowStr && isActive(j)).length,
    thisWeek: data.items.filter(j => j.jobDate <= data.weekEndStr && isActive(j)).length,
    unassigned: data.items.filter(j => j.unassigned && isActive(j)).length,
  }), [data, isActive]);

  const filters: { key: FutureFilter; label: string; count: number }[] = [
    { key: 'active', label: 'Active Only', count: counts.active },
    { key: 'all', label: 'All', count: counts.all },
    { key: 'tomorrow', label: 'Tomorrow', count: counts.tomorrow },
    { key: 'thisWeek', label: 'This Week', count: counts.thisWeek },
    { key: 'unassigned', label: 'Unassigned', count: counts.unassigned },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" aria-label="Back" title="Back" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              <CalendarDays className={`h-5 w-5 shrink-0 ${colors.text}`} />
              <span className="truncate">Future Jobs</span>
              <Badge variant="secondary">{filtered.length}</Badge>
            </h2>
            <p className="text-xs text-muted-foreground">All scheduled future jobs</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <CategoryPill
            key={f.key}
            label={f.label}
            count={f.count}
            active={activeFilter === f.key}
            onClick={() => setFilter(f.key === 'active' ? '' : f.key)}
            sectionKey="futureJobs"
          />
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input aria-label="Search jobs, customers, cleaners" placeholder="Search jobs, customers, cleaners…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.totalCount} future job{data.totalCount !== 1 ? 's' : ''}
      </p>

      {/* Items grouped by date */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No future jobs match this view.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateStr, jobs]) => (
            <div key={dateStr}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {formatDateHeading(dateStr, data.tomorrowStr)}
                <span className="ml-2 text-xs font-normal">({jobs.length})</span>
              </h3>

              {/* Desktop table */}
              <div className="hidden md:block rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Job</th>
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Customer</th>
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Time</th>
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Status</th>
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Assigned</th>
                      <th scope="col" className="text-left p-2.5 font-medium text-xs">Payment</th>
                      <th scope="col" className="p-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr
                        key={j.id}
                        className="border-t border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => openJob(j.id)}
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openJob(j.id)}
                      >
                        <td className="p-2.5">
                          <span className="font-medium text-xs">Job #{j.jobId}</span>
                          {j.service && <span className="text-xs text-muted-foreground ml-1.5">– {j.service}</span>}
                        </td>
                        <td className="p-2.5 text-xs">{j.customerName}</td>
                        <td className="p-2.5 text-xs whitespace-nowrap">
                          {j.startTime ? `${j.startTime}${j.finishTime ? ` – ${j.finishTime}` : ''}` : <span className="text-muted-foreground italic">No time</span>}
                        </td>
                        <td className="p-2.5"><StatusBadge status={j.status ?? undefined} /></td>
                        <td className="p-2.5 text-xs">
                          {j.unassigned ? (
                            <span className="text-amber-600 font-medium">Unassigned</span>
                          ) : (
                            <span className="truncate max-w-[120px] block">{j.assignedCleanerNames.join(', ')}</span>
                          )}
                        </td>
                        <td className="p-2.5"><StatusBadge status={j.paymentStatus ?? undefined} /></td>
                        <td className="p-2.5"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {jobs.map(j => (
                  <Card key={j.id} className="cursor-pointer active:shadow-md transition-shadow" onClick={() => openJob(j.id)}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">Job #{j.jobId}{j.service ? ` – ${j.service}` : ''}</p>
                          <p className="text-xs text-muted-foreground truncate">{j.customerName}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={j.status ?? undefined} />
                        {j.startTime && <span className="text-xs text-muted-foreground">{j.startTime}{j.finishTime ? ` – ${j.finishTime}` : ''}</span>}
                        {j.unassigned && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Unassigned</Badge>}
                      </div>
                      {!j.unassigned && j.assignedCleanerNames.length > 0 && (
                        <p className="text-xs text-muted-foreground">{j.assignedCleanerNames.join(', ')}</p>
                      )}
                      <div className="flex items-center justify-between">
                        {j.address && <p className="text-[10px] text-muted-foreground truncate flex-1">{j.address}</p>}
                        <p className="text-xs font-medium text-primary whitespace-nowrap ml-2">Open Job</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

