import { useEffect, useState, useCallback } from 'react';
import { getUserAccounts } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { StatusBadge } from '@/lib/format';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import UserAccountDialog from './UserAccountDialog';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'userAccountId', label: 'User Account ID', accessor: r => r.userAccountId, kind: 'number' },
  { key: 'name', label: 'Name', accessor: r => [r.firstName, r.lastName].filter(Boolean).join(' '), kind: 'text' },
  { key: 'email', label: 'Email', accessor: r => r.email, kind: 'text' },
  { key: 'role', label: 'Role', accessor: r => r.role, kind: 'text' },
  { key: 'active', label: 'Active Status', accessor: r => r.active ? 'Active' : 'Inactive', kind: 'text' },
  { key: 'createdDate', label: 'Created Date', accessor: r => r.createdDate, kind: 'date' },
];

export default function UserAccountsPage() {
  const req = useTrackedRequest<{ records: any[]; customers: any[]; cleaners: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const customers = req.data?.customers ?? [];
  const cleaners = req.data?.cleaners ?? [];
  const [editItem, setEditItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sp, setSp] = useSearchParams();

  const { sortBy, sortDir } = readSortParams(sp, 'userAccountId', 'desc');

  const load = useCallback(() => {
    req.fire(() => getUserAccounts({}));
  }, [req.fire]);

  useEffect(() => { load(); }, [load]);

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
    else { toast.error('User account not found or no longer exists'); }
  }, [sp, hasData]);

  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);
  const handleRetry = () => load();

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const tiebreaker = SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, field.key !== 'userAccountId' ? tiebreaker : undefined, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">User Accounts</h2>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Create / Invite</Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

      <p className="text-xs text-muted-foreground">{sorted.length} account{sorted.length !== 1 ? 's' : ''}</p>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Email</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Name</th>
            <th className="text-left p-3 font-medium">Role</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Linked Record</th>
            <th className="text-left p-3 font-medium">Active</th>
            <th className="p-3 w-16"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={7} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load user accounts. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No user accounts</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.duplicateEmail ? 'bg-amber-50' : ''}`}>
                <td className="p-3 font-mono text-xs">#{r.userAccountId}</td>
                <td className="p-3">
                  <span className="flex items-center gap-1.5">
                    {r.email}
                    {r.duplicateEmail && (
                      <span title="Duplicate email — multiple accounts share this address" className="inline-flex items-center gap-0.5 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Duplicate</span>
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3 hidden md:table-cell">{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td className="p-3"><StatusBadge status={r.role} /></td>
                <td className="p-3 hidden md:table-cell text-xs">{r.customerName || r.cleanerName || '—'}</td>
                <td className="p-3">{r.active ? <span className="text-green-600 text-xs font-medium">Active</span> : <span className="text-destructive text-xs font-medium">Inactive</span>}</td>
                <td className="p-3"><button className="p-1.5 rounded hover:bg-muted" onClick={() => { setEditItem(r); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserAccountDialog open={dialogOpen} onClose={() => setDialogOpen(false)} item={editItem} customers={customers} cleaners={cleaners} onSaved={() => { setDialogOpen(false); load(); }} />
    </div>
  );
}
