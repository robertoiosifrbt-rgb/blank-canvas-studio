import { useEffect, useState, useCallback } from 'react';
import { getCleaners } from 'zite-endpoints-sdk';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Pencil, RefreshCw, AlertCircle } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams } from 'react-router-dom';
import CleanerFormDialog from './CleanerFormDialog';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'cleanerId', label: 'Cleaner ID', accessor: r => r.cleanerId, kind: 'number' },
  { key: 'cleanerName', label: 'Cleaner Name', accessor: r => r.cleanerName, kind: 'text' },
  { key: 'active', label: 'Active Status', accessor: r => r.active ? 'Active' : 'Inactive', kind: 'text' },
  { key: 'email', label: 'Email', accessor: r => r.email, kind: 'text' },
];

export default function CleanersPage() {
  const req = useTrackedRequest<{ records: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();

  const { sortBy, sortDir } = readSortParams(sp, 'cleanerId', 'desc');

  const load = useCallback((q?: string) => {
    req.fire(() => getCleaners({ search: q }));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);
  const onSearch = useDebouncedCallback((q: string) => load(q), 300);
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);
  const handleRetry = () => load(search);

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const tiebreaker = SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, field.key !== 'cleanerId' ? tiebreaker : undefined, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Cleaners</h2>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add Cleaner</Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cleaners..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }} />
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

      <p className="text-xs text-muted-foreground">{sorted.length} cleaner{sorted.length !== 1 ? 's' : ''}</p>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
            <th className="text-left p-3 font-medium">Active</th>
            <th className="p-3 w-16"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={6} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load cleaners. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No cleaners found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">#{r.cleanerId}</td>
                <td className="p-3 font-medium">{r.cleanerName}</td>
                <td className="p-3 hidden md:table-cell">{r.phone}</td>
                <td className="p-3 hidden md:table-cell">{r.email}</td>
                <td className="p-3">{r.active ? <span className="text-green-600 text-xs font-medium">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</td>
                <td className="p-3"><button className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CleanerFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} item={editItem} onSaved={() => { setDialogOpen(false); load(search); }} />
    </div>
  );
}
