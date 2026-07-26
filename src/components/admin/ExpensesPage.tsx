import { useEffect, useState, useCallback } from 'react';
import { getExpenses, voidRestoreExpense } from 'zite-endpoints-sdk';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pencil, Ban, RotateCcw, Camera, RefreshCw, AlertCircle } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ExpenseDialog from './ExpenseDialog';
import ReceiptScanner from './ReceiptScanner';
import VoidActionDialog from '../shared/VoidActionDialog';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir, type SortField } from '@/lib/sorting';
import { toast } from 'sonner';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

const SORT_FIELDS: SortField<any>[] = [
  { key: 'expenseDate', label: 'Expense Date', accessor: r => r.expenseDate, kind: 'date' },
  { key: 'expenseId', label: 'Expense ID', accessor: r => r.expenseId, kind: 'number' },
  { key: 'supplier', label: 'Supplier', accessor: r => r.supplier, kind: 'text' },
  { key: 'category', label: 'Category', accessor: r => r.category, kind: 'text' },
  { key: 'amount', label: 'Amount', accessor: r => r.amount, kind: 'number' },
  { key: 'receiptAvailable', label: 'Receipt Available', accessor: r => r.receiptAvailable ? 'Yes' : 'No', kind: 'text' },
  { key: 'voidStatus', label: 'Void Status', accessor: r => r.voidStatus, kind: 'text' },
];

const EXPENSE_ID_FIELD = SORT_FIELDS[1];

export default function ExpensesPage() {
  const req = useTrackedRequest<{ records: any[] }>({ timeoutMs: 30000 });
  const records = req.data?.records ?? [];
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voidItem, setVoidItem] = useState<any | null>(null);
  const [voidAction, setVoidAction] = useState<'void' | 'restore'>('void');
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const { sortBy, sortDir } = readSortParams(sp, 'expenseDate', 'desc');

  const load = useCallback((q?: string) => {
    req.fire(() => getExpenses({ search: q }));
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
    else { toast.error('Expense record not found or no longer exists'); }
  }, [sp, hasData]);

  const onSearch = useDebouncedCallback((q: string) => load(q), 300);
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);

  const handleVoid = async (correctionNotes: string) => {
    if (!voidItem) return;
    try {
      const result = await voidRestoreExpense({ expenseId: voidItem.id, action: voidAction, correctionNotes });
      if (result.auditWarning) {
        console.warn('[ExpensesPage] Audit warning:', result.auditWarning);
        toast.warning(`Expense ${voidAction === 'void' ? 'voided' : 'restored'}, but audit history could not be updated.`, { duration: 6000 });
      } else {
        toast.success(voidAction === 'void' ? 'Expense voided' : 'Expense restored');
      }
      setVoidItem(null);
      load(search);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    }
  };

  const handleRetry = () => load(search);

  const showSkeleton = !req.data && !req.error;
  const showFullError = !!req.error && !req.data;
  const showEmpty = !!req.data && records.length === 0;

  const field = SORT_FIELDS.find(f => f.key === sortBy) ?? SORT_FIELDS[0];
  const sorted = sortRecords(records, field, sortDir, EXPENSE_ID_FIELD, 'desc');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <Camera className="h-4 w-4 mr-1" />Scan Receipt
          </Button>
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); onSearch(e.target.value); }} />
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

      <p className="text-xs text-muted-foreground">{sorted.length} expense{sorted.length !== 1 ? 's' : ''}</p>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">ID</th>
            <th className="text-left p-3 font-medium">Date</th>
            <th className="text-left p-3 font-medium">Supplier</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Category</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Linked Job</th>
            <th className="text-right p-3 font-medium">Amount</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Status</th>
            <th className="p-3 w-24"></th>
          </tr></thead>
          <tbody>
            {showSkeleton ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="p-3"><div className="h-5 bg-muted animate-pulse rounded" /></td></tr>
            )) : showFullError ? (
              <tr><td colSpan={8} className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive/60" />
                  <p className="text-muted-foreground">Unable to load expenses. Please try again.</p>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={req.loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${req.loading ? 'animate-spin' : ''}`} />{req.loading ? 'Retrying…' : 'Retry'}
                  </Button>
                </div>
              </td></tr>
            ) : showEmpty ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No expenses found</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className={`border-t border-border hover:bg-muted/30 ${r.voidStatus === 'Voided' ? 'opacity-60' : ''}`}>
                <td className="p-3 font-mono text-xs">#{r.expenseId}</td>
                <td className="p-3">{fmtDate(r.expenseDate)}</td>
                <td className="p-3 font-medium">{r.supplier}</td>
                <td className="p-3 hidden md:table-cell">{r.category}</td>
                <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[160px]">{r.linkedJobLabel || '—'}</td>
                <td className="p-3 text-right font-medium">{fmt(r.amount)}</td>
                <td className="p-3 hidden md:table-cell">
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

      <ExpenseDialog open={dialogOpen} onClose={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) { const d = decodeURIComponent(returnTo); if (d.startsWith('/admin/')) nav(d); }
      }} item={editItem} onSaved={() => {
        setDialogOpen(false);
        const returnTo = sp.get('returnTo');
        if (returnTo) { const d = decodeURIComponent(returnTo); if (d.startsWith('/admin/')) { nav(d); return; } }
        load(search);
      }} />
      <ReceiptScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onSaved={() => { setScannerOpen(false); load(search); }} />
      <VoidActionDialog open={!!voidItem} onClose={() => setVoidItem(null)} action={voidAction} label={`Expense #${voidItem?.expenseId}`} onConfirm={handleVoid} />
    </div>
  );
}
