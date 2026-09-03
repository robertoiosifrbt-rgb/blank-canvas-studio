import { useEffect, useState, useCallback, useRef } from 'react';
import { getPayments, voidRestorePayment, type PaymentListPage } from '@/lib/endpoints';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Ban, RotateCcw, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PaymentDialog from './PaymentDialog';
import VoidActionDialog from '../shared/VoidActionDialog';
import SortControl from './SortControl';
import { readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-401 (Sesiunea 115), mutat la felia 19: **aceeași formă o citește și `PaymentDialog`**,
 * care până acum își declara `item: any` deși pagina asta îi trimite exact rândul de aici.
 */
import type { PaymentRecord as PaymentRow } from '@/lib/adminRecordTypes';

const SORT_FIELDS: SortField<PaymentRow>[] = [
  { key: 'paymentDate', label: 'Payment Date', accessor: r => r.paymentDate, kind: 'date' },
  { key: 'paymentId', label: 'Payment ID', accessor: r => r.paymentId, kind: 'number' },
  { key: 'customerName', label: 'Customer', accessor: r => r.customerName, kind: 'text' },
  { key: 'amount', label: 'Amount', accessor: r => r.amount, kind: 'number' },
  { key: 'paymentStatus', label: 'Payment Status', accessor: r => r.paymentStatus, kind: 'text' },
  { key: 'paymentMethod', label: 'Payment Method', accessor: r => r.paymentMethod, kind: 'text' },
  { key: 'voidStatus', label: 'Void Status', accessor: r => r.voidStatus, kind: 'text' },
];


export default function PaymentsPage() {
  const req = useTrackedRequest<PaymentListPage>({ timeoutMs: 30000 });
  /** ⚠️ Tiparul casei: `fire` desprins, ca lista de dependențe să nu poarte tot obiectul hookului. */
  const { fire } = req;
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  /**
   * ⚠️ **Referință, nu stare:** dacă `search` ar fi în dependențele lui `load`, fiecare literă
   * tastată i-ar schimba identitatea, iar efectul de ordine ar reîncărca lista la fiecare tastă.
   */
  const searchRef = useRef('');
  const [editItem, setEditItem] = useState<PaymentRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // ACHU-401 (felia 16): e același rând ca în listă — tipul exista deja în fișier.
  const [voidItem, setVoidItem] = useState<PaymentRow | null>(null);
  const [voidAction, setVoidAction] = useState<'void' | 'restore'>('void');
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const { sortBy, sortDir } = readSortParams(sp, 'paymentDate', 'desc');

  /** 🔴 §47 (Sesiunea 154) — cererea duce acum ordinea și pagina; lista vine gata sortată. */
  const load = useCallback((q?: string, atPage = 1) => {
    fire(() => getPayments({ search: q, sortBy, sortDir, page: atPage }));
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
    const next = new URLSearchParams(sp);
    next.delete('id');
    setSp(next, { replace: true });
    const found = records.find(r => r.id === targetId);
    if (found) { setEditItem(found); setDialogOpen(true); }
    else { toast.error('Payment record not found or no longer exists'); }
  }, [sp, hasData]);

  const onSearch = useDebouncedCallback((q: string) => load(q), 300);
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);

  const handleVoid = async (correctionNotes: string) => {
    if (!voidItem) return;
    try {
      await voidRestorePayment({ paymentId: voidItem.id, action: voidAction, correctionNotes });
      /**
       * 🔴 ACHU-751 — al doilea loc cu același mesaj imposibil. Stingerea unei plăți scrie
       * auditul CRITIC, în aceeași tranzacție (ACHU-AUD-007): dacă istoricul nu se poate scrie,
       * plata nu se stinge. Deci „voided, but audit history could not be updated" descria o
       * stare care nu poate exista.
       */
      toast.success(voidAction === 'void' ? 'Payment voided' : 'Payment restored');
      setVoidItem(null);
      load(search);
    } catch (e) {
      toast.error(errMsg(e) || 'Failed');
    }
  };

  const handleRetry = () => load(search);

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
        title="Payments"
        actions={
          <>
            <RefreshButton onRefresh={handleRetry} />
            <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </>
        }
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search payments" placeholder="Search payments..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); searchRef.current = e.target.value; onSearch(e.target.value); }} />
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

      <p className="text-xs text-muted-foreground">{sorted.length} payment{sorted.length !== 1 ? 's' : ''}</p>

      <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm" aria-label="Payments">
          <thead><tr className="bg-muted/50">
            <th scope="col" className="text-left p-3 font-medium">ID</th>
            <th scope="col" className="text-left p-3 font-medium">Customer</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Job</th>
            <th scope="col" className="text-left p-3 font-medium">Date</th>
            <th scope="col" className="text-right p-3 font-medium">Amount</th>
            <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Method</th>
            <th scope="col" className="text-left p-3 font-medium">Status</th>
            <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Void</th>
            <th scope="col" className="p-3 w-24"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={9} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={9} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load payments. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No payments found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.voidStatus === 'Voided' ? 'opacity-60' : ''}`}>
                <td className="p-3 font-mono text-xs">#{r.paymentId}</td>
                <td className="p-3 font-medium">{r.customerName}</td>
                <td className="p-3 hidden md:table-cell text-xs">{r.jobLabel}</td>
                <td className="p-3">{fmtDate(r.paymentDate)}</td>
                <td className="p-3 text-right font-medium">{fmt(r.amount)}</td>
                <td className="p-3 hidden md:table-cell">{r.paymentMethod}</td>
                <td className="p-3"><StatusBadge status={r.paymentStatus} /></td>
                <td className="p-3 hidden lg:table-cell">
                  {r.voidStatus === 'Voided' ? <Badge variant="destructive" className="text-xs">Voided</Badge> : <Badge variant="outline" className="text-xs">Active</Badge>}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button aria-label={`Edit payment #${r.paymentId}`} title={`Edit payment #${r.paymentId}`} className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    {(!r.voidStatus || r.voidStatus === 'Active') ? (
                      <button aria-label={`Void payment #${r.paymentId}`} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title={`Void payment #${r.paymentId}`} onClick={() => { setVoidItem(r); setVoidAction('void'); }}><Ban className="h-3.5 w-3.5" /></button>
                    ) : (
                      <button aria-label={`Restore payment #${r.paymentId}`} className="p-1.5 rounded hover:bg-primary/10 text-primary" title={`Restore payment #${r.paymentId}`} onClick={() => { setVoidItem(r); setVoidAction('restore'); }}><RotateCcw className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/**
        * 🔴 §47 (Sesiunea 154) — bara de pagini. ⚠️ Spune întâi **CE** se răsfoiește: „51–100 din
        * 214" e propoziția pe care o caută cineva care nu găsește o plată. ⛔ Apare numai când
        * există mai mult de o pagină.
        */}
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

      <PaymentDialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) { const d = decodeURIComponent(returnTo); if (d.startsWith('/admin/')) nav(d); }
      }} item={editItem} onSaved={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) { const d = decodeURIComponent(returnTo); if (d.startsWith('/admin/')) { nav(d); return; } }
        load(search);
      }} />
      <VoidActionDialog open={!!voidItem} onClose={() => setVoidItem(null)} action={voidAction} label={`Payment #${voidItem?.paymentId}`} onConfirm={handleVoid} />
    </div>
  );
}

