import { useState, useEffect, useCallback } from 'react';
import { getJobChecklist, GetJobChecklistOutputType } from 'zite-endpoints-sdk';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Check, Minus } from 'lucide-react';

type Group = GetJobChecklistOutputType['groups'][0];
type Item = Group['items'][0];

export default function AdminChecklistSection({ jobId }: { jobId: string }) {
  const [data, setData] = useState<GetJobChecklistOutputType | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJobChecklist({ jobId });
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton className="h-20 w-full" />;
  if (!data?.hasChecklist || data.total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Cleaner Work Checklist</h4>
        </div>
        <Badge variant={data.completed >= data.total ? 'default' : 'secondary'} className="text-xs">
          {data.completed} / {data.total}
        </Badge>
      </div>
      <div className="space-y-2">
        {data.groups.map(group => (
          <AdminGroupSection key={group.groupName} group={group} />
        ))}
      </div>
    </div>
  );
}

function AdminGroupSection({ group }: { group: Group }) {
  const done = group.items.filter(i => i.completed || i.notApplicable).length;
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
        {group.groupName}
        <span className="text-[10px] font-normal">{done}/{group.items.length}</span>
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => <AdminItemRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function AdminItemRow({ item }: { item: Item }) {
  const isDone = item.completed || item.notApplicable;
  const fmtTime = item.completedAt
    ? new Date(item.completedAt).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <div className={`flex items-start gap-2 py-1 px-1 rounded text-sm ${isDone ? 'opacity-60' : ''}`}>
      <span className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center mt-0.5 ${
        item.notApplicable ? 'bg-muted border-muted-foreground' :
        item.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
      }`}>
        {item.completed && <Check className="h-2.5 w-2.5" />}
        {item.notApplicable && <Minus className="h-2.5 w-2.5" />}
      </span>
      <div className="flex-1 min-w-0">
        <span className={isDone ? 'line-through text-muted-foreground' : ''}>{item.itemLabel}</span>
        {isDone && (
          <span className="text-[10px] text-muted-foreground block">
            {item.completedBy}{fmtTime ? ` · ${fmtTime}` : ''}
          </span>
        )}
        {item.notApplicable && item.notApplicableReason && (
          <span className="text-[10px] text-muted-foreground block">N/A: {item.notApplicableReason}</span>
        )}
        {item.notes && (
          <span className="text-[10px] text-muted-foreground block break-words whitespace-pre-wrap">{item.notes}</span>
        )}
      </div>
    </div>
  );
}
