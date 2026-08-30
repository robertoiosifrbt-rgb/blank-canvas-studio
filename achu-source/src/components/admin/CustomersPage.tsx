import { useEffect, useState, useCallback, useRef } from 'react';
import { getCustomers, type CustomerListPage } from '@/lib/endpoints';
import { deleteRecord } from '@/lib/endpoints';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Pencil, Eye, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams } from 'react-router-dom';
import CustomerDialog from './CustomerDialog';
import DeleteConfirm from '../shared/DeleteConfirm';
import SortControl from './SortControl';
import { readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';
// ACHU-552 — marcajele măsurate. Aceleași cuvinte pe listă și pe fișă, dintr-un singur loc.
import { CustomerRiskCell } from './CustomerRiskSignals';
/**
 * ACHU-401 (Sesiunea 115), mutat la felia 19: **aceeași formă o citește și `CustomerDialog`**,
 * care până acum își declara `item: any` deși pagina asta îi trimite exact rândul de aici.
 */
import type { CustomerRecord as CustomerRow } from '@/lib/adminRecordTypes';

const SORT_FIELDS: SortField<CustomerRow>[] = [
  { key: 'customerId', label: 'Customer ID', accessor: r => r.customerId, kind: 'number' },
  { key: 'customerName', label: 'Customer Name', accessor: r => r.customerName, kind: 'text' },
  { key: 'status', label: 'Status', accessor: r => r.status, kind: 'text' },
  { key: 'customerType', label: 'Customer Type', accessor: r => r.customerType, kind: 'text' },
  /**
   * 🔴 ACHU-524. This read `r.createdDate`, which no row has carried since the
   * move off Zite — so the accessor returned `undefined` for EVERY row, both
   * sides of every comparison were null, and `compare()` returned 0 each time
   * (`src/lib/sorting.ts:30`).
   *
   * ⚠️ The result was NOT "nothing happens". The `sortRecords` call below
   * passes a tiebreaker of `customerId` descending, which decides every
   * comparison once the primary one ties — so choosing "Created Date" silently
   * sorted by Customer ID instead. A wrong order that looks like an order.
   *
   * ⚠️ Found by typing this array: `SortField<any>` accepted an accessor for a
   * field that does not exist. Nothing else could see it — the test fixtures
   * carried `createdDate` too, so the suite agreed with the bug.
   */
  { key: 'createdDate', label: 'Created Date', accessor: r => r.createdAt ?? r.createdDate, kind: 'date' },
  /**
   * 🆕 §4 (Sesiunea 157). ⚠️ Se sortează pe **ziua** din răspuns, nu pe textul afișat — iar rândurile
   * fără dată cad la capăt, ca peste tot (`lib/sorting.ts`).
   */
  { key: 'lastJobDate', label: 'Last Job Date', accessor: r => r.lastJobDate, kind: 'date' },
  { key: 'nextJobDate', label: 'Next Job Date', accessor: r => r.nextJobDate, kind: 'date' },
  { key: 'lastContactAt', label: 'Last Contact Date', accessor: r => r.lastContactAt, kind: 'date' },
  { key: 'lifetimeReceived', label: 'Paid To Date', accessor: r => r.lifetimeReceived, kind: 'number' },
  /** ⚠️ Se sortează pe MEDIE; câți au votat rămâne lângă cifră, ca să nu se citească singură. */
  { key: 'averageRating', label: 'Average Rating', accessor: r => r.averageRating, kind: 'number' },
];

export default function CustomersPage() {
  const req = useTrackedRequest<CustomerListPage>({ timeoutMs: 30000 });
  /** ⚠️ Tiparul casei: `fire` desprins, ca dependențele să nu poarte tot obiectul hookului. */
  const { fire } = req;
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  /** ⚠️ Referință, nu stare: altfel fiecare literă tastată ar schimba identitatea lui `load`. */
  const searchRef = useRef('');
  const [editItem, setEditItem] = useState<CustomerRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<CustomerRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Sesiunea 97: "fisa clientului se deschide din butonul edit... poti sa le
  // separi?" — View and Edit used to be the same click. Two buttons now open
  // the same dialog, one locked and one not.
  const [dialogReadOnly, setDialogReadOnly] = useState(false);
  const [sp, setSp] = useSearchParams();

  const { sortBy, sortDir } = readSortParams(sp, 'customerId', 'desc');

  /** 🔴 §47 (Sesiunea 154) — cererea duce ordinea și pagina; lista vine gata sortată de server. */
  const load = useCallback((q?: string, atPage = 1) => {
    fire(() => getCustomers({ search: q, sortBy, sortDir, page: atPage }));
  }, [fire, sortBy, sortDir]);

  /** ⚠️ Ordinea se hotărăște pe server, deci schimbarea ei e o cerere nouă, de la pagina 1. */
  const sortKey = `${sortBy}|${sortDir}`;
  useEffect(() => { load(searchRef.current, 1); }, [sortKey, load]);
  useEffect(() => { if (sp.get('new')) setDialogOpen(true); }, [sp]);

  // ACHU-112: Auto-open record from URL ?id=
  const hasData = !!req.data;
  useEffect(() => {
    const targetId = sp.get('id');
    if (!targetId || !hasData) return;
    // Clean up ?id= to prevent re-opening on data reload
    const next = new URLSearchParams(sp);
    next.delete('id');
    setSp(next, { replace: true });
    const found = records.find(r => r.id === targetId);
    if (found) { setEditItem(found); setDialogReadOnly(false); setDialogOpen(true); }
    else { toast.error('Customer record not found or no longer exists'); }
  }, [sp, hasData]);

  const onSearch = useDebouncedCallback((q: string) => load(q), 300);
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);
  const handleRetry = () => load(search);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteRecord({ table: 'customers', id: deleteItem.id });
      toast.success('Customer deleted');
      setDeleteItem(null);
      load(search);
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to delete customer');
      setDeleteItem(null);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  /**
   * 🔴 §47 — ordinea NU se mai face aici: ecranul primește o **pagină**, iar sortarea în browser ar
   * fi însemnat „sortate între ele cele cincizeci de pe pagina asta".
   */
  const sorted = records;
  const page = req.data?.page ?? 1;
  const total = req.data?.total ?? 0;
  const pageSize = req.data?.pageSize ?? 50;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="Customers"
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
          <Input aria-label="Search customers" placeholder="Search customers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); searchRef.current = e.target.value; onSearch(e.target.value); }} />
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

      <p className="text-xs text-muted-foreground">{sorted.length} customer{sorted.length !== 1 ? 's' : ''}</p>

      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm" aria-label="Customers">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-3 font-medium">ID</th>
            <th scope="col" className="text-left p-3 font-medium">Name</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Email</th>
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Type</th>
            <th scope="col" className="text-left p-3 font-medium">Status</th>
            {/*
              🆕 §4 (Sesiunea 157) — cele două întrebări pe care biroul le pune despre un client:
              când am fost ultima dată, când mergem iar. ⚠️ Ascunse sub `lg`: pe telefon rămân
              numele, starea și marcajele — adică de ce se deschide lista.
            */}
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Last job</th>
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Next job</th>
            {/* 🆕 §4 „Last contact date" — din registrul de discuții; gol înseamnă NECONSEMNAT. */}
            <th scope="col" className="text-left p-3 font-medium hidden xl:table-cell">Last contact</th>
            {/*
              🆕 §4 (Sesiunea 157) — cât a intrat de la om, și cât de mulțumit e.
              ⛔ „Paid to date" nu e profit și nu e cât datorează; nota vine cu **din câte**, fiindcă
              „5.0" din una și „4.6" din treizeci nu spun același lucru.
            */}
            <th scope="col" className="text-right p-3 font-medium hidden xl:table-cell">Paid to date</th>
            <th scope="col" className="text-left p-3 font-medium hidden xl:table-cell">Rating</th>
            {/* ACHU-552 — marcajele MĂSURATE, nu bifate. Vezi CustomerRiskSignals.tsx. */}
            <th scope="col" className="text-left p-3 font-medium">Watch out for</th>
            <th scope="col" className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={13} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={13} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load customers. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">No customers found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">#{r.customerId}</td>
                <td className="p-3 font-medium">{r.customerName}</td>
                <td className="p-3 hidden md:table-cell">{r.phone}</td>
                <td className="p-3 hidden md:table-cell break-all">{r.email}</td>
                <td className="p-3 hidden lg:table-cell">{r.customerType}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                {/* ⛔ `fmtDate`, nu o formatare locală: ziua în ora UK, nu în fusul calculatorului (ACHU-787). */}
                <td className="p-3 hidden lg:table-cell text-xs whitespace-nowrap">{r.lastJobDate ? fmtDate(r.lastJobDate) : '—'}</td>
                {/* ⚠️ Gol = nimic programat. Propoziția de sub tabel spune că e un fapt, nu un defect. */}
                <td className={`p-3 hidden lg:table-cell text-xs whitespace-nowrap ${r.nextJobDate ? '' : 'text-muted-foreground'}`}>{r.nextJobDate ? fmtDate(r.nextJobDate) : '—'}</td>
                <td className="p-3 hidden xl:table-cell text-xs whitespace-nowrap">
                  {/* ⛔ „No contact logged" e un fapt despre REGISTRU, nu o afirmație despre om. */}
                  {r.lastContactAt
                    ? fmtDate(r.lastContactAt)
                    : <span className="text-muted-foreground">No contact logged</span>}
                </td>
                {/* ⛔ `fmt`, dintr-un singur loc: lirele se scriu la fel pe toate ecranele. */}
                <td className="p-3 hidden xl:table-cell text-xs text-right whitespace-nowrap">
                  {r.lifetimeReceived === undefined ? '—' : fmt(r.lifetimeReceived)}
                </td>
                <td className="p-3 hidden xl:table-cell text-xs whitespace-nowrap">
                  {r.ratingCount ? `${r.averageRating?.toFixed(1)} (${r.ratingCount})`
                    : <span className="text-muted-foreground">No ratings</span>}
                </td>
                <td className="p-3"><CustomerRiskCell risk={r.risk} /></td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button title="View" className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogReadOnly(true); setDialogOpen(true); }}><Eye className="h-3.5 w-3.5" /></button>
                    <button title="Edit" className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogReadOnly(false); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button title="Delete" className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setDeleteItem(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/*
        🔴 §4 (Sesiunea 157) — ce înseamnă o coloană „Next job" goală: **nimic programat**, nu un
        defect de ecran. ⚠️ Apare doar când lista are rânduri, ca să nu vorbească despre nimic.
      */}
      {req.data?.activityNote && records.length > 0 && (
        <p className="text-xs text-muted-foreground">{req.data.activityNote}</p>
      )}

      {/** 🔴 §47 (Sesiunea 154) — bara spune **CE** se răsfoiește, nu doar „‹ 2 ›". */}
      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} din {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || req.loading} onClick={() => load(searchRef.current, page - 1)}>Înapoi</Button>
            <span className="text-muted-foreground tabular-nums">{page} / {lastPage}</span>
            <Button variant="outline" size="sm" disabled={page >= lastPage || req.loading} onClick={() => load(searchRef.current, page + 1)}>Înainte</Button>
          </div>
        </div>
      )}

      <CustomerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={editItem}
        readOnly={dialogReadOnly}
        onSaved={() => { setDialogOpen(false); load(search); }}
      />
      <DeleteConfirm open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} label={deleteItem?.customerName} />
    </div>
  );
}

