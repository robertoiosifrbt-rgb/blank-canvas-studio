import { useEffect, useState, useCallback } from 'react';
import { getJobs, deleteRecord } from 'zite-endpoints-sdk';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Pencil, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useNavigate } from 'react-router-dom';
import JobDialog from './JobDialog';
import DeleteConfirm from '../shared/DeleteConfirm';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'jobDate', label: 'Job Date', accessor: r => r.jobDate, kind: 'date' },
  { key: 'jobId', label: 'Job ID', accessor: r => r.jobId, kind: 'number' },
  { key: 'customerName', label: 'Customer', accessor: r => r.customerName, kind: 'text' },
  { key: 'status', label: 'Status', accessor: r => r.status, kind: 'text' },
  { key: 'service', label: 'Service', accessor: r => r.service, kind: 'text' },
  { key: 'amountCharged', label: 'Amount Charged', accessor: r => r.amountCharged, kind: 'number' },
  { key: 'amountReceived', label: 'Amount Received', accessor: r => r.amountReceived, kind: 'number' },
  { key: 'outstandingBalance', label: 'Outstanding Balance', accessor: r => r.outstandingBalance, kind: 'number' },
];

const JOB_ID_FIELD = SORT_FIELDS[1];

export default function JobsPage() {
  const req = useTrackedRequest<{ records: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const { sortBy, sortDir } = readSortParams(sp, 'jobDate', 'desc');

  const load = useCallback((q?: string) => {
    req.fire(() => getJobs({ search: q }));
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
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete job');
      setDeleteItem(null);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, JOB_ID_FIELD, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Jobs</h2>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }} />
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

      <p className="text-xs text-muted-foreground">{sorted.length} job{sorted.length !== 1 ? 's' : ''}</p>

      {/* Desktop table */}
      <div className="rounded-lg border border-border overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Customer</th>
            <th className="text-left p-3 font-medium">Date</th>
            <th className="text-left p-3 font-medium">Service</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-right p-3 font-medium">Charged</th>
            <th className="text-right p-3 font-medium hidden lg:table-cell">Received</th>
            <th className="text-right p-3 font-medium hidden lg:table-cell">Outstanding</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Payment</th>
            <th className="text-left p-3 font-medium hidden xl:table-cell">Quote #</th>
            <th className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={11} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={11} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load jobs. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No jobs found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">#{r.jobId}</td>
                <td className="p-3 font-medium">{r.customerName}</td>
                <td className="p-3">{fmtDate(r.jobDate)}</td>
                <td className="p-3">{r.service}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right">{fmt(r.amountCharged)}</td>
                <td className="p-3 text-right hidden lg:table-cell">{fmt(r.amountReceived)}</td>
                <td className="p-3 text-right hidden lg:table-cell">{fmt(r.outstandingBalance)}</td>
                <td className="p-3 hidden lg:table-cell"><StatusBadge status={r.paymentStatus} /></td>
                <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground truncate max-w-[140px]">{r.quoteNumber || '—'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={() => setDeleteItem(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4"><div className="h-24 bg-muted animate-pulse rounded" /></div>
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
        ) : sorted.map(r => (
          <div key={r.id} className="rounded-lg border border-border p-4 space-y-3 active:bg-muted/30" onClick={() => { setEditItem(r); setDialogOpen(true); }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{r.customerName}</p>
                <p className="text-xs text-muted-foreground font-mono">#{r.jobId}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <StatusBadge status={r.status} />
                <button className="p-1.5 rounded hover:bg-destructive/10 text-destructive" onClick={e => { e.stopPropagation(); setDeleteItem(r); }}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div><span className="text-xs text-muted-foreground">Job Date</span><p>{fmtDate(r.jobDate)}</p></div>
              <div><span className="text-xs text-muted-foreground">Scheduled Start</span><p>{r.startTime || '—'}</p></div>
            </div>
            {r.quoteNumber && (
              <div className="text-sm"><span className="text-xs text-muted-foreground">Quote Number</span><p className="break-all">{r.quoteNumber}</p></div>
            )}
            <div className="border-t border-border pt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div><span className="text-xs text-muted-foreground">Amount Charged</span><p className="font-medium">{fmt(r.amountCharged)}</p></div>
              <div><span className="text-xs text-muted-foreground">Amount Received</span><p className="font-medium">{fmt(r.amountReceived)}</p></div>
              <div><span className="text-xs text-muted-foreground">Outstanding Balance</span><p className={`font-medium ${(r.outstandingBalance ?? 0) > 0 ? 'text-orange-600' : ''}`}>{fmt(r.outstandingBalance)}</p></div>
              <div><span className="text-xs text-muted-foreground">Payment Status</span><StatusBadge status={r.paymentStatus} /></div>
            </div>
          </div>
        ))}
      </div>

      <JobDialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) {
          const decoded = decodeURIComponent(returnTo);
          if (decoded.startsWith('/admin/')) nav(decoded);
        }
      }} item={editItem} onSaved={() => {
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
