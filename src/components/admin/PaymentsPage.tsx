import { useEffect, useState, useCallback } from 'react';
import { getPayments, voidRestorePayment } from 'zite-endpoints-sdk';
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
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'paymentDate', label: 'Payment Date', accessor: r => r.paymentDate, kind: 'date' },
  { key: 'paymentId', label: 'Payment ID', accessor: r => r.paymentId, kind: 'number' },
  { key: 'customerName', label: 'Customer', accessor: r => r.customerName, kind: 'text' },
  { key: 'amount', label: 'Amount', accessor: r => r.amount, kind: 'number' },
  { key: 'paymentStatus', label: 'Payment Status', accessor: r => r.paymentStatus, kind: 'text' },
  { key: 'paymentMethod', label: 'Payment Method', accessor: r => r.paymentMethod, kind: 'text' },
  { key: 'voidStatus', label: 'Void Status', accessor: r => r.voidStatus, kind: 'text' },
];

const PAYMENT_ID_FIELD = SORT_FIELDS[1];

export default function PaymentsPage() {
  const req = useTrackedRequest<{ records: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidItem, setVoidItem] = useState<any | null>(null);
  const [voidAction, setVoidAction] = useState<'void' | 'restore'>('void');
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const { sortBy, sortDir } = readSortParams(sp, 'paymentDate', 'desc');

  const load = useCallback((q?: string) => {
    req.fire(() => getPayments({ search: q }));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);
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
      const result = await voidRestorePayment({ paymentId: voidItem.id, action: voidAction, correctionNotes });
      if (result.auditWarning) {
        console.warn('[PaymentsPage] Audit warning:', result.auditWarning);
        toast.warning(`Payment ${voidAction === 'void' ? 'voided' : 'restored'}, but audit history could not be updated.`, { duration: 6000 });
      } else {
        toast.success(voidAction === 'void' ? 'Payment voided' : 'Payment restored');
      }
      setVoidItem(null);
      load(search);
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const handleRetry = () => load(search);

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, PAYMENT_ID_FIELD, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Payments</h2>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payments..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }} />
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

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Customer</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Job</th>
            <th className="text-left p-3 font-medium">Date</th>
            <th className="text-right p-3 font-medium">Amount</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Method</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Void</th>
            <th className="p-3 w-24"></th>
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
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    {(!r.voidStatus || r.voidStatus === 'Active') ? (
                      <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Void" onClick={() => { setVoidItem(r); setVoidAction('void'); }}><Ban className="h-3.5 w-3.5" /></button>
                    ) : (
                      <button className="p-1.5 rounded hover:bg-primary/10 text-primary" title="Restore" onClick={() => { setVoidItem(r); setVoidAction('restore'); }}><RotateCcw className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
