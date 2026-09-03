import { useEffect, useState, useCallback, useRef } from 'react';
import JobCoverageBadge from './JobCoverageBadge';
import { getJobs, deleteRecord, type JobListPage } from '@/lib/endpoints';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Eye, Pencil, Trash2, RefreshCw, AlertCircle, Calculator, ChevronRight, Repeat } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
// §17 (Sesiunea 154) — steagurile de fereastră, scrise într-un singur loc pentru cele trei ecrane.
import { ScheduleFlagBadges } from './ScheduleFlagBadges';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useNavigate } from 'react-router-dom';
import JobDialog from './JobDialog';
import BulkAssignBar from './BulkAssignBar';
import DeleteConfirm from '../shared/DeleteConfirm';
import SortControl from './SortControl';
import { readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import { groupJobs, jobGroupOf, jobWantsAPrice, groupCountsFromStatuses, type JobGroupKey } from '@/lib/jobGrouping';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-401 (Sesiunea 115), mutat la felia 19: **aceeași formă o citește și `JobDialog`**, care
 * până acum își declara `item: any` deși pagina asta îi trimite exact rândul de aici.
 */
import type { JobRecord as JobRow } from '@/lib/adminRecordTypes';

const SORT_FIELDS: SortField<JobRow>[] = [
  { key: 'jobDate', label: 'Job Date', accessor: r => r.jobDate, kind: 'date' },
  { key: 'jobId', label: 'Job ID', accessor: r => r.jobId, kind: 'number' },
  { key: 'customerName', label: 'Customer', accessor: r => r.customerName, kind: 'text' },
  { key: 'status', label: 'Status', accessor: r => r.status, kind: 'text' },
  { key: 'service', label: 'Service', accessor: r => r.service, kind: 'text' },
  { key: 'amountCharged', label: 'Amount Charged', accessor: r => r.amountCharged, kind: 'number' },
  { key: 'amountReceived', label: 'Amount Received', accessor: r => r.amountReceived, kind: 'number' },
  { key: 'outstandingBalance', label: 'Outstanding Balance', accessor: r => r.outstandingBalance, kind: 'number' },
];


/**
 * §41 „Bulk operations" (Sesiunea 148) — bara de selecție și previzualizarea trăiesc în fișierul
 * lor: ele SCRIU, iar pagina asta doar ține ce e bifat. ⚠️ Motivele întregi: `BulkAssignBar.tsx`.
 */

export default function JobsPage() {
  const req = useTrackedRequest<JobListPage>({ timeoutMs: 30000 });
  /** ⚠️ Tiparul casei: `fire` desprins, ca lista de dependențe să nu poarte tot obiectul hookului. */
  const { fire } = req;
  const records = req.data?.records ?? [];
  /**
   * 🔴 §47 (Sesiunea 154) — **pagina o spune RĂSPUNSUL, nu o ține ecranul.**
   *
   * ⚠️ O stare proprie ar fi trebuit ținută în pas cu serverul la fiecare căutare, sortare și
   * pastilă — iar la primul pas greșit bara ar fi scris „pagina 3" peste rândurile paginii 1.
   * ⛔ Serverul întoarce pagina pe care a servit-o; ecranul o citește de acolo, deci nu au cum să
   * se despartă. ✅ Și scapă de o scriere de stare dintr-un efect, pe care lint-ul o refuză oricum.
   */
  const [search, setSearch] = useState('');
  /**
   * ⚠️ **Referințe, nu stare**, pentru cele două lucruri pe care `load` le citește: dacă ar fi în
   * lista lui de dependențe, fiecare literă tastată i-ar schimba identitatea, iar efectul de ordine
   * ar reîncărca lista la fiecare apăsare de tastă — exact ce evită deja `useDebouncedCallback`.
   */
  const searchRef = useRef('');
  const statusCountsRef = useRef<Record<string, number>>({});
  /**
   * §41 (Sesiunea 148) — ce e bifat, ca **mulțime de id-uri**. ⚠️ Nu un câmp pe rând: rândurile se
   * reîncarcă, se re-sortează și se filtrează, iar o bifă lipită pe obiectul rândului ar dispărea la
   * fiecare reîmprospătare. ⛔ Iar un id care nu mai e în listă pur și simplu nu se mai afișează
   * bifat — nu trebuie curățat de nimeni.
   */
  const [selected, setSelected] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<JobRow | null>(null);
  /**
   * ACHU-519 — Archana: „ca să văd detaliile la un job trebuie să îl editez?" Yes, and that was
   * wrong: the pencil was the only way in, so a look and a change to the price were one click.
   * ACHU-444 settled this for customers at Roberto's request; jobs never got it.
   */
  const [dialogReadOnly, setDialogReadOnly] = useState(false);
  const [deleteItem, setDeleteItem] = useState<JobRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // ACHU-429: which section the chips have narrowed to, and which sections the
  // user has folded or unfolded away from their default.
  const [groupFilter, setGroupFilter] = useState<JobGroupKey | 'all'>('all');
  const [openGroups, setOpenGroups] = useState<Partial<Record<JobGroupKey, boolean>>>({});
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const { sortBy, sortDir } = readSortParams(sp, 'jobDate', 'desc');

  /**
   * 🔴 §47 (Sesiunea 154) — cererea duce ACUM ordinea, pagina și secțiunea.
   *
   * ⚠️ **Secțiunea pleacă ca listă de STĂRI, nu ca nume de secțiune:** împărțirea stare → secțiune e
   * regula din `jobGrouping.ts` și rămâne aici. ⛔ Trimis ca „scheduled", serverul ar fi trebuit să
   * cunoască împărțirea — al doilea adevăr despre aceeași regulă.
   *
   * ⚠️ Stările le aflăm din ce a numărat serverul (`statusCounts`), deci lista e mereu a datelor
   * reale, nu una scrisă de mână care s-ar învechi la prima stare nouă.
   */
  const statusesFor = useCallback((key: JobGroupKey | 'all', counts: Record<string, number>) => (
    key === 'all' ? undefined : Object.keys(counts).filter(st => jobGroupOf(st) === key).join(',')
  ), []);

  const load = useCallback((q?: string, atPage = 1, section: JobGroupKey | 'all' = groupFilter) => {
    fire(() => getJobs({
      search: q,
      sortBy, sortDir,
      page: atPage,
      ...(statusesFor(section, statusCountsRef.current) ? { statuses: statusesFor(section, statusCountsRef.current)! } : {}),
    }));
  }, [fire, sortBy, sortDir, groupFilter, statusesFor]);

  /** ⚠️ Ordinea se hotărăște pe server, deci schimbarea ei e o cerere nouă, de la pagina 1. */
  const sortKey = `${sortBy}|${sortDir}`;
  useEffect(() => { load(searchRef.current, 1); }, [sortKey, load]);

  /** ⚠️ Ținut lângă ultimul răspuns: pastilele au nevoie de stările din setul filtrat, nu de o listă scrisă de mână. */
  useEffect(() => { if (req.data) statusCountsRef.current = req.data.statusCounts; }, [req.data]);
  useEffect(() => { if (sp.get('new')) setDialogOpen(true); }, [sp]);

  // ACHU-112: Auto-open record from URL ?id=
  const hasData = !!req.data;
  useEffect(() => {
    const targetId = sp.get('id');
    if (!targetId || !hasData) return;
    const next = new URLSearchParams(sp);
    next.delete('id');
    setSp(next, { replace: true });
    const found = records.find(r => r.id === targetId);
    if (found) { setEditItem(found); setDialogReadOnly(true); setDialogOpen(true); }
    else { toast.error('Job record not found or no longer exists'); }
  }, [sp, hasData]);

  const onSearch = useDebouncedCallback((q: string) => load(q), 300);
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);
  const handleRetry = () => load(search);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteRecord({ table: 'jobs', id: deleteItem.id });
      toast.success('Job deleted');
      setDeleteItem(null);
      load(search);
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to delete job');
      setDeleteItem(null);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  /**
   * 🔴 §47 (Sesiunea 154) — **ordinea și îngustarea NU se mai fac aici.** Rândurile vin gata
   * sortate și gata filtrate pe secțiune, fiindcă ecranul primește o **pagină**: sortate în browser,
   * ar fi însemnat „sortate între ele cele treizeci de pe pagina asta".
   */
  const filtered = records;

  /**
   * ⚠️ Cifrele pastilelor vin din ce a **numărat serverul** peste tot setul căutat — nu din rândurile
   * primite. ⛔ Numărate din pagină, ar fi spus „câte sunt pe pagina asta", iar cine apasă „Enquiries
   * 3" pe o listă de nouăzeci ar fi citit o cifră falsă.
   */
  const statusCounts = req.data?.statusCounts ?? {};
  const groupCounts = groupCountsFromStatuses(statusCounts);
  const allCount = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const page = req.data?.page ?? 1;
  const total = req.data?.total ?? 0;
  const pageSize = req.data?.pageSize ?? 50;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  /**
   * Secțiunile de pe telefon se construiesc din **pagina** primită, dar titlul poartă cifra
   * ADEVĂRATĂ. ⚠️ Altfel un titlu ar spune „Enquiries 12" pe o pagină care are trei dintre ele.
   */
  const trueCount = new Map(groupCounts.map(g => [g.key, g.count]));
  const pageGroups = groupJobs(records).map(g => ({ ...g, trueCount: trueCount.get(g.key) ?? g.jobs.length }));
  const visibleGroups = groupFilter === 'all' ? pageGroups : pageGroups.filter(g => g.key === groupFilter);

  /**
   * A section is open unless it is folded by default AND the user has not said
   * otherwise. ⚠️ Derived at render rather than seeded into state in an effect:
   * the group list changes every time the data reloads, and an effect syncing
   * state to it would both trip `react-hooks/set-state-in-effect` (the lint gate
   * is an exact ratchet, `CLAUDE.md` §2.1a) and re-fold a section the user had
   * just opened.
   */
  const isOpen = (g: { key: JobGroupKey; collapsedByDefault: boolean }) =>
    // ⚠️ `groupFilter === g.key` matters: picking a section from the chips is an
    // explicit request to SEE it. Without this, tapping "Cancelled & no access 3"
    // narrowed the page to exactly one section and then showed it folded — a
    // screen containing nothing but the heading you just asked to open.
    openGroups[g.key] ?? (groupFilter === g.key || !g.collapsedByDefault);

  const toggleGroup = (key: JobGroupKey, open: boolean) => setOpenGroups(o => ({ ...o, [key]: open }));

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="Jobs"
        actions={
          <>
            <RefreshButton onRefresh={handleRetry} />
            <Button onClick={() => { setEditItem(null); setDialogReadOnly(false); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </>
        }
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search jobs" placeholder="Search jobs..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); searchRef.current = e.target.value; onSearch(e.target.value); }} />
        </div>
        <SortControl options={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSort} />
      </div>

      {req.error && records.length > 0 && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${req.stale ? 'bg-amber-50 border border-amber-200' : 'bg-destructive/10 border border-destructive/20'}`}>
          <AlertCircle className={`h-4 w-4 shrink-0 ${req.stale ? 'text-amber-600' : 'text-destructive'}`} />
          <p className={`text-sm flex-1 ${req.stale ? 'text-amber-800' : 'text-destructive'}`}>{req.error}{req.stale ? ' — showing cached data' : ''}</p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={req.loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {/* ACHU-429 — jump straight to a section. The counts are the point as
          much as the filtering: they answer "what is in this list" before you
          have scrolled it. */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setGroupFilter('all'); load(searchRef.current, 1, 'all'); }}
          aria-pressed={groupFilter === 'all'}
          className={`rounded-full border px-3 py-1 text-xs ${groupFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
        >
          All {allCount}
        </button>
        {groupCounts.map(g => (
          <button
            key={g.key}
            onClick={() => { setGroupFilter(g.key); load(searchRef.current, 1, g.key); }}
            aria-pressed={groupFilter === g.key}
            className={`rounded-full border px-3 py-1 text-xs ${groupFilter === g.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {g.label} {g.count}
          </button>
        ))}
      </div>

      {/**
        * §41 (Sesiunea 148) — bara apare doar când există o selecție, și doar pe ecran lat (ea
        * însăși se ascunde pe telefon: o selecție de douăzeci de căsuțe pe un telefon e o greșeală
        * care așteaptă să se întâmple, iar munca asta se face la birou).
        */}
      <BulkAssignBar
        selectedIds={selected}
        onClear={() => setSelected([])}
        onDone={() => load(search)}
      />

      {/* Desktop table */}
      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto hidden md:block">
        <table className="w-full text-sm" aria-label="Jobs">
          <thead><tr className="bg-muted/50">
            {/**
              * §41 (Sesiunea 148) — ⚠️ bifa din antet lucrează pe **ce se vede acum** (`filtered`),
              * nu pe toate vizitele din bază. ⛔ „Selectează tot" într-o listă filtrată care ar lua și
              * ce nu se vede e chiar felul în care o operație în masă atinge ceva ce nimeni n-a citit.
              */}
            <th scope="col" className="p-3 w-8">
              <input
                type="checkbox"
                aria-label="Select every job shown"
                checked={filtered.length > 0 && filtered.every(r => selected.includes(r.id))}
                onChange={e => setSelected(e.target.checked ? filtered.map(r => r.id) : [])}
              />
            </th>
            <th scope="col" className="text-left p-3 font-medium">ID</th>
            <th scope="col" className="text-left p-3 font-medium">Customer</th>
            <th scope="col" className="text-left p-3 font-medium">Date</th>
            <th scope="col" className="text-left p-3 font-medium">Service</th>
            <th scope="col" className="text-left p-3 font-medium">Status</th>
            <th scope="col" className="text-right p-3 font-medium">Charged</th>
            <th scope="col" className="text-right p-3 font-medium hidden lg:table-cell">Received</th>
            <th scope="col" className="text-right p-3 font-medium hidden lg:table-cell">Outstanding</th>
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Payment</th>
            <th scope="col" className="text-left p-3 font-medium hidden xl:table-cell">Quote #</th>
            <th scope="col" className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={12} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={12} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load jobs. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">No jobs found</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Select job #${r.jobId}`}
                    checked={selected.includes(r.id)}
                    onChange={e => setSelected(prev => (e.target.checked
                      ? [...prev, r.id]
                      : prev.filter(id => id !== r.id)))}
                  />
                </td>
                <td className="p-3 font-mono text-xs">#{r.jobId}</td>
                <td className="p-3 font-medium">{r.customerName}</td>
                {/* §17 — steagul stă lângă DATĂ, nu într-o coloană nouă: e un fapt despre ziua
                    aceea, iar tabelul are deja 12 coloane. ⚠️ Cifra întreagă e în `title`. */}
                <td className="p-3">{fmtDate(r.jobDate)}<ScheduleFlagBadges flags={r.scheduleFlags} className="ml-1.5 align-middle" /><JobCoverageBadge coverage={r.coverage} className="ml-1.5 align-middle" /></td>
                <td className="p-3">{r.service}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                {/* ACHU-421: "£0.00" and "a price is calculated and waiting"
                    are different facts, and the table showed them identically. */}
                <td className="p-3 text-right">
                  {r.pendingQuote
                    ? <span className="text-muted-foreground whitespace-nowrap" title={`Suggested by quote ${r.pendingQuote.quoteNumber} — not applied`}>({fmt(r.pendingQuote.grandTotal)})</span>
                    : fmt(r.amountCharged)}
                </td>
                <td className="p-3 text-right hidden lg:table-cell">{fmt(r.amountReceived)}</td>
                <td className="p-3 text-right hidden lg:table-cell">{fmt(r.outstandingBalance)}</td>
                <td className="p-3 hidden lg:table-cell"><StatusBadge status={r.paymentStatus} /></td>
                <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground truncate max-w-[140px]">{r.quoteNumber || '—'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button title="View" className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogReadOnly(true); setDialogOpen(true); }}><Eye className="h-3.5 w-3.5" /></button>
                    <button title="Edit" className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogReadOnly(false); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button aria-label={`Delete job #${r.jobId}`} title={`Delete job #${r.jobId}`} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setDeleteItem(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — ACHU-429: sectioned, dense, cancelled folded away */}
      <div className="md:hidden space-y-4">
        {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4"><div className="h-16 bg-muted animate-pulse rounded" /></div>
        )) : showFullError ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-muted-foreground text-center">Unable to load jobs. Please try again.</p>
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : showEmpty ? (
          <p className="text-center text-muted-foreground py-8">No jobs found</p>
        ) : visibleGroups.map(group => {
          const open = isOpen(group);
          return (
            <section key={group.key}>
              {/* The heading is the control. A separate chevron would be a second
                  tap target for one action, and a heading that looks inert next
                  to a collapsed section reads as an empty section. */}
              <button
                onClick={() => toggleGroup(group.key, !open)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 py-2 text-left"
              >
                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-xs text-muted-foreground">{group.trueCount}</span>
              </button>

              {open && (
                <div className="space-y-2">
                  {/* ACHU-519: tapping a card OPENS it, it does not start editing it — the
                      whole point of the split, and it matters more on a phone where a mis-tap
                      lands on a field. */}
                  {group.jobs.map(r => (
                    <div key={r.id} className="rounded-lg border border-border p-3 active:bg-muted/30" onClick={() => { setEditItem(r); setDialogReadOnly(true); setDialogOpen(true); }}>
                      {/* Line 1 — the DATE leads. In a list of visits it is the
                          field that differs between neighbours; the service and
                          the customer very often do not. On the owner's screen
                          three consecutive cards shared everything except this. */}
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold tabular-nums">
                          {fmtDate(r.jobDate)}
                          {r.startTime && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.startTime}{r.finishTime ? `–${r.finishTime}` : ''}</span>}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* §17 — lângă ora programată, fiindcă despre ea vorbește. */}
                          <ScheduleFlagBadges flags={r.scheduleFlags} />
                          {/* The status badge is redundant inside its own
                              section — the heading already said it. Kept only
                              where the section covers more than one status. */}
                          {(group.key === 'scheduled' || group.key === 'closed') && <StatusBadge status={r.status} />}
                          <button aria-label={`Delete job #${r.jobId}`} title={`Delete job #${r.jobId}`} className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={e => { e.stopPropagation(); setDeleteItem(r); }}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>

                      {/* Line 2 — what and for whom, on ONE line. */}
                      <p className="text-sm break-words">
                        {r.service || <span className="text-muted-foreground">No service set</span>}
                        {r.recurringSeriesId && (
                          <span title="Part of a repeating booking" className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs text-muted-foreground">
                            <Repeat className="h-3 w-3" />repeat
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {r.customerName}<span className="font-mono"> · #{r.jobId}</span>
                        {r.address && <span> · {r.address}</span>}
                      </p>

                      {/* Money — only when it says something. ⛔ Notably NOT
                          "No price set" on cancelled work: on the owner's screen
                          that line sat under three cancelled visits, reading as
                          three outstanding tasks that did not exist. */}
                      {r.pendingQuote ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                          <Calculator className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="text-muted-foreground">Suggested</span>
                          <span className="font-medium">{fmt(r.pendingQuote.grandTotal)}</span>
                          <span className="text-xs text-muted-foreground">— not applied</span>
                        </p>
                      ) : (r.amountCharged ?? 0) > 0 ? (
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-medium">{fmt(r.amountCharged)}</span>
                          {(r.outstandingBalance ?? 0) > 0 && (
                            <span className="text-xs"><span className="text-muted-foreground">Outstanding </span><span className="font-medium text-orange-600">{fmt(r.outstandingBalance)}</span></span>
                          )}
                          <StatusBadge status={r.paymentStatus} />
                        </p>
                      ) : jobWantsAPrice(r) ? (
                        <p className="mt-1.5 text-sm text-muted-foreground">No price set</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/**
        * 🔴 §47 (Sesiunea 154) — BARA DE PAGINI.
        *
        * ⚠️ **Spune întâi CE se răsfoiește**, apoi butoanele: „31–60 din 214" e propoziția pe care
        * o caută cineva care nu găsește un rând. ⛔ O bară cu doar „‹ 2 ›" lasă întrebarea „din
        * câte?" fără răspuns, iar omul derulează la nesfârșit ca să afle.
        *
        * ⚠️ Apare **numai** când există mai mult de o pagină: pe o listă de zece rânduri ar fi un
        * rând de interfață care nu face nimic.
        */}
      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} din {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || req.loading}
              onClick={() => load(searchRef.current, page - 1)}
            >
              Înapoi
            </Button>
            <span className="text-muted-foreground tabular-nums">{page} / {lastPage}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage || req.loading}
              onClick={() => load(searchRef.current, page + 1)}
            >
              Înainte
            </Button>
          </div>
        </div>
      )}

      <JobDialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) {
          const decoded = decodeURIComponent(returnTo);
          if (decoded.startsWith('/admin/')) nav(decoded);
        }
      }} item={editItem} readOnly={dialogReadOnly} onSaved={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) {
          const decoded = decodeURIComponent(returnTo);
          if (decoded.startsWith('/admin/')) { nav(decoded); return; }
        }
        load(search);
      }} />
      <DeleteConfirm open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} label={`Job #${deleteItem?.jobId}`} />
    </div>
  );
}

