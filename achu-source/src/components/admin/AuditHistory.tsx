import { useEffect, useState, useCallback, useRef } from 'react';
import { getAuditHistory, GetAuditHistoryOutputType } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import DateField from '@/components/shared/DateField';
import { ChevronDown, ChevronUp, History, Loader2, Search, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { errMsg } from '@/lib/errorMessage';

type AuditEvent = GetAuditHistoryOutputType['events'][0];

function fmtTimestamp(ts?: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ts; }
}

function parseJson(s?: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function DiffDisplay({ prev, next }: { prev: Record<string, unknown> | null; next: Record<string, unknown> | null }) {
  if (!prev && !next) return null;
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  if (keys.size === 0) return null;
  return (
    <div className="text-xs mt-1 space-y-0.5">
      {Array.from(keys).map(k => {
        const pv = prev?.[k];
        const nv = next?.[k];
        if (String(pv ?? '') === String(nv ?? '') && pv !== undefined) return null;
        return (
          <div key={k} className="flex gap-1 flex-wrap">
            <span className="text-muted-foreground font-medium">{k}:</span>
            {pv !== undefined && <span className="line-through text-muted-foreground">{String(pv)}</span>}
            {nv !== undefined && <span className="text-foreground">{String(nv)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function EventItem({ ev }: { ev: AuditEvent }) {
  return (
    <div className="p-2.5 border-b border-border last:border-b-0 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium capitalize">{(ev.action ?? '').replace(/_/g, ' ')}</span>
        <span className="text-muted-foreground shrink-0">{fmtTimestamp(ev.timestamp)}</span>
      </div>
      {ev.performedBy && <p className="text-muted-foreground">by {ev.performedBy}</p>}
      {ev.summary && <p className="mt-0.5">{ev.summary}</p>}
      {ev.correctionNotes && <p className="text-muted-foreground italic mt-0.5">Note: {ev.correctionNotes}</p>}
      <DiffDisplay prev={parseJson(ev.previousValues)} next={parseJson(ev.newValues)} />
    </div>
  );
}

const INLINE_PAGE_SIZE = 20;

/**
 * Inline audit history widget — used inside record dialogs.
 * ACHU-103: Refresh after mutations via refreshKey, inline pagination via Load More.
 * ACHU-104: Error visibility with cached data preservation.
 */
export default function AuditHistory({ entityType, entityId, refreshKey }: { entityType: string; entityId: string; refreshKey?: number }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const prevEntityRef = useRef('');
  const prevRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ACHU-103: Reset when entity changes
  const entityKey = `${entityType}:${entityId}`;
  useEffect(() => {
    if (prevEntityRef.current && prevEntityRef.current !== entityKey) {
      setEvents([]);
      setError(null);
      setHasMore(false);
      setOpen(false);
      ++seqRef.current;
    }
    prevEntityRef.current = entityKey;
  }, [entityKey]);

  const loadEvents = useCallback(async (reset = true) => {
    const mySeq = ++seqRef.current;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    const offset = reset ? 0 : events.length;
    try {
      const res = await getAuditHistory({ entityType, entityId, offset, limit: INLINE_PAGE_SIZE });
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      if (reset) {
        setEvents(res.events);
      } else {
        setEvents(prev => [...prev, ...res.events]);
      }
      setHasMore(res.hasMore);
    } catch (e) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setError(errMsg(e) ?? 'Failed to load audit history');
      // ACHU-104: Preserve previously loaded events
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [entityType, entityId, events.length]);

  const toggleOrLoad = () => {
    if (!open) {
      setOpen(true);
      loadEvents(true);
    } else {
      setOpen(false);
    }
  };

  // ACHU-103: Auto-refresh when refreshKey changes (after mutation)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKeyRef.current && open) {
      loadEvents(true);
    }
    prevRefreshKeyRef.current = refreshKey;
  }, [refreshKey, open]);

  return (
    <div>
      <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={toggleOrLoad}>
        <History className="h-3.5 w-3.5 mr-1.5" />
        Audit History
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </Button>
      {open && (
        <div className="mt-2 border border-border rounded-lg max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-muted/30 sticky top-0 z-[1]">
            <span className="text-xs text-muted-foreground font-medium">History</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => loadEvents(true)} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
          {error && (
            <div className="px-2.5 py-2 bg-destructive/5 border-b border-destructive/20 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-xs text-destructive flex-1">{error}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => loadEvents(true)} disabled={loading}>Retry</Button>
            </div>
          )}
          {loading && events.length === 0 ? (
            <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading...</div>
          ) : events.length === 0 && !error ? (
            <div className="p-3 text-sm text-muted-foreground">No audit history</div>
          ) : (
            <>
              {events.map(ev => <EventItem key={ev.id} ev={ev} />)}
              {hasMore && (
                <div className="p-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => loadEvents(false)} disabled={loadingMore}>
                    {loadingMore ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Loading...</> : <><ChevronDown className="h-3 w-3 mr-1" />Load More</>}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Standalone Audit History Page — full filtering UI for Admin.
 * ACHU-101: __all__ normalised. ACHU-102: Pagination. ACHU-105/106: Filters from shared constants.
 */
export function AuditHistoryPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [entityId, setEntityId] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  // ACHU-105/106: Dynamic lists from backend (populated from shared constants)
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  const PAGE_SIZE = 50;

  const load = useCallback(async (pageOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditHistory({
        entityType: entityType || undefined,
        action: action || undefined,
        entityId: entityId || undefined,
        performedBy: performedBy || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        offset: pageOffset,
        limit: PAGE_SIZE,
      });
      setEvents(res.events);
      setHasMore(res.hasMore);
      setTotal(res.total);
      setOffset(pageOffset);
      if (res.entityTypes?.length) setEntityTypes(res.entityTypes);
      if (res.actions?.length) setActions(res.actions);
    } catch (e) {
      setError(errMsg(e) ?? 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  }, [entityType, action, entityId, performedBy, startDate, endDate]);

  /**
   * §39 (Sesiunea 148) — exportul folosește ACELEAȘI filtre pe care le vede omul pe ecran.
   * ⛔ Nu paginarea: un fișier de pe „pagina 3" n-ar putea fi descris de nimeni.
   */
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      /**
       * 🔴 **IMPORT DINAMIC, și e o reparație măsurată, nu un truc.** ⛔ Un `import` static din
       * `@/lib/auditExportEndpoints` a rupt **12 suite de teste** la ÎNCĂRCARE: ecranul ăsta e
       * importat de multe pagini, ale căror teste mochează `@/lib/endpoints` (unde stă restul) —
       * dar nu un modul nou, deci `apiClient` real ajungea în graf și construia un client Supabase
       * fără chei.
       *
       * ⚠️ A cere fiecăruia din cele 12 un mock în plus ar fi mutat costul pe ele, la fiecare modul
       * nou. ✅ Aici, calea de descărcare se încarcă **la apăsare** — singurul moment în care e
       * nevoie de ea.
       */
      const { exportAuditLog } = await import('@/lib/auditExportEndpoints');
      await exportAuditLog({
        entityType: entityType || undefined, entityId: entityId || undefined,
        action: action || undefined, performedBy: performedBy || undefined,
        startDate: startDate || undefined, endDate: endDate || undefined,
      });
    } catch (e) {
      // ⚠️ Mesajul SERVERULUI: el știe câte rânduri sunt și ce plafon a fost depășit.
      setError(errMsg(e) || 'Could not export the audit log.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { load(0); }, []);

  const handleSearch = () => { load(0); };
  const handleNext = () => { if (hasMore) load(offset + PAGE_SIZE); };
  const handlePrev = () => { if (offset > 0) load(Math.max(0, offset - PAGE_SIZE)); };

  return (
    <div className="space-y-4">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        icon={<History className="h-6 w-6" />}
        title="Audit History"
        actions={
          <Button variant="outline" size="sm" onClick={() => load(offset)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label htmlFor="audithisto-entity-type" className="text-xs">Entity Type</Label>
          <Select value={entityType} onValueChange={v => setEntityType(v === '__all__' ? '' : v)}>
            <SelectTrigger id="audithisto-entity-type" className="h-8 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Types</SelectItem>
              {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="audithisto-action" className="text-xs">Action</Label>
          <Select value={action} onValueChange={v => setAction(v === '__all__' ? '' : v)}>
            <SelectTrigger id="audithisto-action" className="h-8 text-sm"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Actions</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="audithisto-entity-id" className="text-xs">Entity ID</Label>
          <Input id="audithisto-entity-id" className="h-8 text-sm" placeholder="Record ID..." value={entityId} onChange={e => setEntityId(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="audithisto-performed-by" className="text-xs">Performed By</Label>
          <Input id="audithisto-performed-by" className="h-8 text-sm" placeholder="Email..." value={performedBy} onChange={e => setPerformedBy(e.target.value)} />
        </div>
        {/* ACHU-415/417 — `col-span-2` below md, and it is the actual fix.
            A 193px column on a phone cannot hold a control that renders 209px,
            and no CSS I could verify from here made it shrink. A full-width row
            gives it ~398px and never asks. */}
        <div className="col-span-2 md:col-span-1">
          <Label className="text-xs" htmlFor="ah-from">From Date</Label>
          <DateField id="ah-from" className="h-8 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Label className="text-xs" htmlFor="ah-to">To Date</Label>
          <DateField id="ah-to" className="h-8 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSearch}>
          <Search className="h-3.5 w-3.5 mr-1" />Search
        </Button>
        {/*
          🔴 §39 „Export audit log" (Sesiunea 148) — lângă Search, nu într-un meniu: exportă EXACT
          filtrele de deasupra, deci butonul are sens doar acolo unde ele se văd.
          ⚠️ Serverul refuză peste plafon, cu propoziția care spune să se strângă intervalul —
          mesajul lui ajunge la om, nu unul inventat aici.
        */}
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-3.5 w-3.5 mr-1" />{exporting ? 'Preparing…' : 'Export CSV'}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => load(offset)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading...</div>
      ) : events.length === 0 && !error ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No audit events found matching the current filters.</CardContent></Card>
      ) : events.length > 0 ? (
        <>
          <div tabIndex={0} className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm" aria-label="Audit history">
              <thead>
                <tr className="bg-muted/50">
                  <th scope="col" className="text-left p-3 font-medium">Time</th>
                  <th scope="col" className="text-left p-3 font-medium">Type</th>
                  <th scope="col" className="text-left p-3 font-medium">Action</th>
                  <th scope="col" className="text-left p-3 font-medium hidden md:table-cell">Summary</th>
                  <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">By</th>
                  {/*
                    🔴 §39 „Source" (Sesiunea 150) — „cum a ajuns rândul aici": de pe un ecran (`ui`),
                    de la un script cu un token (`api`), sau de la aplicație singură (`system`).
                    ⛔ **Nu e o dovadă** — antetele pe care se sprijină pot fi scrise de mână (motivul
                    întreg în `backend/src/lib/auditSource.ts`); e un indiciu de triaj.
                    ⚠️ Gol pe rândurile de dinainte de 22/08/2026, fiindcă atunci nu se măsura.
                  */}
                  <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">How</th>
                  <th scope="col" className="text-left p-3 font-medium hidden lg:table-cell">Changes</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 text-xs whitespace-nowrap">{fmtTimestamp(ev.timestamp)}</td>
                    <td className="p-3 text-xs">{ev.entityType}</td>
                    <td className="p-3 text-xs capitalize">{(ev.action ?? '').replace(/_/g, ' ')}</td>
                    <td className="p-3 text-xs hidden md:table-cell max-w-[250px] truncate">{ev.summary}</td>
                    <td className="p-3 text-xs hidden lg:table-cell">{ev.performedBy}</td>
                    <td className="p-3 text-xs hidden lg:table-cell text-muted-foreground">{ev.source ?? '—'}</td>
                    <td className="p-3 hidden lg:table-cell">
                      <DiffDisplay prev={parseJson(ev.previousValues)} next={parseJson(ev.newValues)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {offset + 1}–{Math.min(offset + events.length, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={offset === 0 || loading}>Previous</Button>
              <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore || loading}>Next</Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

