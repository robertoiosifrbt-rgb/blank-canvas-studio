import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Users, Briefcase, CreditCard, Receipt, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { globalSearch } from 'zite-endpoints-sdk';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';

const SEARCH_TIMEOUT_MS = 15000;

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const nav = useNavigate();
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  /** The query string that was active when we last fired a request */
  const activeQueryRef = useRef('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const doSearch = useDebouncedCallback(async (q: string) => {
    if (q.length < 2) {
      // Short/empty query — invalidate everything outstanding
      ++seqRef.current;
      activeQueryRef.current = '';
      setResults(null);
      setError(null);
      setStale(false);
      setLoading(false);
      setOpen(false);
      return;
    }
    const mySeq = ++seqRef.current;
    activeQueryRef.current = q;
    setLoading(true);
    setError(null);
    setStale(false);
    try {
      const data = await Promise.race([
        globalSearch({ query: q }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Search timed out')), SEARCH_TIMEOUT_MS)),
      ]);
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setResults(data);
      setError(null);
      setStale(false);
      setOpen(true);
    } catch (e: any) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      const msg = e?.message || 'Search failed';
      setError(msg);
      // Preserve previous results — mark stale
      setStale(results !== null);
      setOpen(true);
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setLoading(false);
    }
  }, 300);

  const handleChange = useCallback((val: string) => {
    setQuery(val);
    if (val.length < 2) {
      // Immediately invalidate — don't wait for debounce
      doSearch.cancel();
      ++seqRef.current;
      activeQueryRef.current = '';
      setResults(null);
      setError(null);
      setStale(false);
      setLoading(false);
      setOpen(false);
    } else {
      doSearch(val);
    }
  }, [doSearch]);

  const handleRetry = useCallback(() => {
    const q = query;
    if (q.length >= 2) {
      // Fire immediately (bypass debounce) for retry
      doSearch.cancel();
      doSearch(q);
      doSearch.flush();
    }
  }, [query, doSearch]);

  const go = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    ++seqRef.current;
    activeQueryRef.current = '';
    setResults(null);
    setError(null);
    setStale(false);
    nav(path);
  }, [nav]);

  const total = results ? results.customers.length + results.jobs.length + results.payments.length + results.expenses.length : 0;
  const hasResults = results && total > 0;

  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Search customers, jobs, payments..." className="pl-9 pr-9" value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => query.length >= 2 && (results || error) && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}

      {open && error && !hasResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center space-y-2">
          <AlertCircle className="h-5 w-5 mx-auto text-destructive/60" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {open && hasResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
          {stale && error && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="flex-1">{error} — showing cached results</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleRetry} disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Retry
              </Button>
            </div>
          )}
          {results.customers.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Customers</p>
              {results.customers.map((c: any) => (
                <button key={c.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted" onClick={() => go(`/admin/customers?id=${c.id}`)}>{c.customerName}</button>
              ))}
            </div>
          )}
          {results.jobs.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Jobs</p>
              {results.jobs.map((j: any) => (
                <button key={j.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted" onClick={() => go(`/admin/jobs?id=${j.id}`)}>#{j.jobId} — {j.service}</button>
              ))}
            </div>
          )}
          {results.payments.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payments</p>
              {results.payments.map((p: any) => (
                <button key={p.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted" onClick={() => go(`/admin/payments?id=${p.id}`)}>#{p.paymentId}</button>
              ))}
            </div>
          )}
          {results.expenses.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 flex items-center gap-1"><Receipt className="h-3 w-3" /> Expenses</p>
              {results.expenses.map((e: any) => (
                <button key={e.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted" onClick={() => go(`/admin/expenses?id=${e.id}`)}>{e.supplier} — {e.description}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {open && !error && results && total === 0 && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">No results found</div>
      )}
    </div>
  );
}
