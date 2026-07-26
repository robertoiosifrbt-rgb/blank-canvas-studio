import { useEffect, useState, useCallback } from 'react';
import { getCustomers } from 'zite-endpoints-sdk';
import { deleteRecord } from 'zite-endpoints-sdk';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Pencil, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge, fmtDate } from '@/lib/format';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams } from 'react-router-dom';
import CustomerDialog from './CustomerDialog';
import DeleteConfirm from '../shared/DeleteConfirm';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'customerId', label: 'Customer ID', accessor: r => r.customerId, kind: 'number' },
  { key: 'customerName', label: 'Customer Name', accessor: r => r.customerName, kind: 'text' },
  { key: 'status', label: 'Status', accessor: r => r.status, kind: 'text' },
  { key: 'customerType', label: 'Customer Type', accessor: r => r.customerType, kind: 'text' },
  { key: 'createdDate', label: 'Created Date', accessor: r => r.createdDate, kind: 'date' },
];

export default function CustomersPage() {
  const req = useTrackedRequest<{ records: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();

  const { sortBy, sortDir } = readSortParams(sp, 'customerId', 'desc');

  const load = useCallback((q?: string) => {
    req.fire(() => getCustomers({ search: q }));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);
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
    if (found) { setEditItem(found); setDialogOpen(true); }
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
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete customer');
      setDeleteItem(null);
    }
  };

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const tiebreaker = SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, field.key !== 'customerId' ? tiebreaker : undefined, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Customers</h2>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }} />
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

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Type</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="p-3 w-20"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={7} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load customers. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No customers found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">#{r.customerId}</td>
                <td className="p-3 font-medium">{r.customerName}</td>
                <td className="p-3 hidden md:table-cell">{r.phone}</td>
                <td className="p-3 hidden md:table-cell">{r.email}</td>
                <td className="p-3 hidden lg:table-cell">{r.customerType}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
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

      <CustomerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} item={editItem} onSaved={() => { setDialogOpen(false); load(search); }} />
      <DeleteConfirm open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} label={deleteItem?.customerName} />
    </div>
  );
}
