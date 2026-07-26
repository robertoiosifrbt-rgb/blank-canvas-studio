import { useState, useEffect, useCallback, useRef } from 'react';
import { getJobChecklist, updateJobChecklistItem, GetJobChecklistOutputType } from 'zite-endpoints-sdk';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ClipboardCheck, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** ACHU-116: Generate a unique request token for idempotency */
let clTokenCounter = 0;
function genToken(): string {
  return `cl-${Date.now()}-${++clTokenCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

type ChecklistGroup = GetJobChecklistOutputType['groups'][0];
type ChecklistItem = ChecklistGroup['items'][0];

/** ACHU-116: Request timeout */
const REQUEST_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export default function WorkChecklist({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<GetJobChecklistOutputType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);
  // ACHU-116: Cancel stale requests
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await withTimeout(getJobChecklist({ jobId }), REQUEST_TIMEOUT);
      if (mountedRef.current) setData(res);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [jobId]);

  // ACHU-117: Load ONLY on first expand — never eagerly
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  }, [open, load]);

  // Show the collapsible header even without data (user can open to load)
  const progress = data ? `${data.completed} / ${data.total}` : '';
  const allDone = data ? data.completed >= data.total && data.total > 0 : false;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            Work Checklist
          </span>
          <span className="flex items-center gap-2">
            {data && data.total > 0 && (
              <Badge variant={allDone ? 'default' : 'secondary'} className="text-xs">
                {progress}
              </Badge>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3">
          {loading && !data && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          )}
          {error && (
            <div className="bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive flex-1">Failed to load checklist</p>
              <Button size="sm" variant="outline" onClick={load} className="shrink-0">
                <RefreshCw className="h-3 w-3 mr-1" />Retry
              </Button>
            </div>
          )}
          {data && !data.hasChecklist && (
            <p className="text-sm text-muted-foreground px-1">No checklist available for this job.</p>
          )}
          {data?.hasChecklist && data.groups.map((group) => (
            <ChecklistGroupSection key={group.groupName} group={group} onUpdate={load} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChecklistGroupSection({ group, onUpdate }: { group: ChecklistGroup; onUpdate: () => void }) {
  const done = group.items.filter(i => i.completed || i.notApplicable).length;
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
        {group.groupName}
        <span className="text-[10px] font-normal">{done}/{group.items.length}</span>
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => (
          <ChecklistItemRow key={item.id} item={item} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

function ChecklistItemRow({ item, onUpdate }: { item: ChecklistItem; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ACHU-116: Token ref for idempotent retry
  const tokenRef = useRef<string>('');

  const toggle = async () => {
    if (debounceRef.current || saving) return;
    debounceRef.current = true;
    const token = genToken();
    tokenRef.current = token;
    setSaving(true);
    try {
      const newCompleted = !item.completed && !item.notApplicable;
      await withTimeout(
        updateJobChecklistItem({ checklistItemId: item.id, completed: newCompleted, requestToken: token }),
        REQUEST_TIMEOUT,
      );
      onUpdate();
    } catch (e: any) {
      if (mountedRef.current) toast.error(e?.message || 'Failed to update');
    } finally {
      if (mountedRef.current) setSaving(false);
      setTimeout(() => { debounceRef.current = false; }, 300);
    }
  };

  const isDone = item.completed || item.notApplicable;
  const fmtTime = item.completedAt
    ? new Date(item.completedAt).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`w-full flex items-center gap-3 min-h-[44px] px-2 py-1.5 rounded-md transition-colors text-left ${
        isDone ? 'opacity-60' : 'hover:bg-muted/60'
      }`}
    >
      <span className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
        isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
      }`}>
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isDone ? (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : null}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`text-sm block ${isDone ? 'line-through text-muted-foreground' : ''}`}>
          {item.itemLabel}
        </span>
        {isDone && fmtTime && (
          <span className="text-[10px] text-muted-foreground block">{fmtTime}{item.completedBy ? ` · ${item.completedBy}` : ''}</span>
        )}
        {item.notApplicable && (
          <span className="text-[10px] text-muted-foreground block">N/A{item.notApplicableReason ? `: ${item.notApplicableReason}` : ''}</span>
        )}
        {item.notes && (
          <span className="text-[10px] text-muted-foreground block break-words whitespace-pre-wrap">{item.notes}</span>
        )}
      </span>
    </button>
  );
}

/** Export progress hook for completion dialog — ACHU-117: does NOT load eagerly */
export function useChecklistProgress(jobId: string) {
  const [data, setData] = useState<GetJobChecklistOutputType | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await withTimeout(getJobChecklist({ jobId }), REQUEST_TIMEOUT);
      setData(res);
    } catch { /* ignore */ }
  }, [jobId]);
  // NOTE: Does NOT call load() on mount — caller must call reload() explicitly
  return { data, reload: load };
}
