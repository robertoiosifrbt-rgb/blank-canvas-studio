import { useState, useEffect, useCallback } from 'react';
import { getJobChecklist, GetJobChecklistOutputType } from '@/lib/endpoints';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Check, Minus } from 'lucide-react';
// §16 (Sesiunea 144) — de aici se mută un punct între „trebuie făcut" și „e bine dacă se face".
import ChecklistRequiredToggle from './ChecklistRequiredToggle';
/**
 * §16 „Customer-requested additions" (Sesiunea 148) — de aici se adaugă un punct care trăiește pe
 * ACEASTĂ vizită, și de aici se scoate. ⚠️ Motivele întregi: `VisitExtraPoint.tsx`.
 */
import { AddVisitPoint, RemoveVisitPoint } from './VisitExtraPoint';
/** Constanta e a serverului; ecranul o citește, nu o rescrie. */
const VISIT_EXTRA_SOURCE = 'visitExtra';

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
  /**
   * 🔴 **§16 (Sesiunea 148) — nu mai e `return null` gol.**
   *
   * ⛔ Înainte, o vizită fără checklist nu arăta nimic aici — deci nu exista niciun loc în care
   * biroul să poată adăuga primul punct, exact pe vizitele care n-au ofertă (abonamentele). ⚠️ Se
   * arată doar formularul, fără insigna și fără linia de obligații: acelea ar fi numărat zero și ar
   * fi spus, cu cifre, ceva ce nu s-a măsurat.
   */
  if (!data) return null;
  if (!data.hasChecklist || data.total === 0) {
    return <AddVisitPoint jobId={jobId} onAdded={load} />;
  }

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
      {/**
        * 🔴 §16 (Sesiunea 144) — **linia care spune ce OPREȘTE încheierea vizitei.**
        *
        * ⚠️ Insigna de sus (`completed / total`) numără toată munca vizitei, și rămâne așa. Dar de
        * când un punct poate fi opțional, cifra aceea nu mai răspunde la întrebarea pe care o are
        * biroul: *se poate închide?* ⛔ Fără rândul de mai jos, cineva ar vedea „10 / 12" și un
        * refuz care spune „au rămas 0 obligatorii" — două cifre adevărate care nu se pot împăca.
        *
        * ⚠️ Apare **doar** când există puncte opționale: pe majoritatea vizitelor cele două cifre
        * sunt identice, iar o linie care repetă insigna de deasupra e zgomot.
        */}
      {data.requiredTotal !== data.total && (
        <p className="text-[11px] text-muted-foreground">
          {data.requiredCompleted} of {data.requiredTotal} required
          {data.optionalOpen > 0 && ` · ${data.optionalOpen} optional still open`}
          {' — only the required ones stop this job being completed.'}
        </p>
      )}
      <div className="space-y-2">
        {data.groups.map(group => (
          <AdminGroupSection key={group.groupName} group={group} onUpdate={load} />
        ))}
      </div>
      <AddVisitPoint jobId={jobId} onAdded={load} />
    </div>
  );
}

function AdminGroupSection({ group, onUpdate }: { group: Group; onUpdate: () => void }) {
  const done = group.items.filter(i => i.completed || i.notApplicable).length;
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
        {group.groupName}
        <span className="text-[10px] font-normal">{done}/{group.items.length}</span>
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => <AdminItemRow key={item.id} item={item} onUpdate={onUpdate} />)}
      </div>
    </div>
  );
}

function AdminItemRow({ item, onUpdate }: { item: Item; onUpdate: () => void }) {
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
        {/* ⚠️ Se marchează ce e NEOBIȘNUIT. Aproape totul e obligatoriu, deci o insignă „Required"
            pe fiecare rând ar fi tapet, iar ochiul ar înceta să vadă exact excepția. */}
        {!item.required && (
          <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground align-middle">
            Optional
          </span>
        )}
        {/**
          * §16 (Sesiunea 144) — ⚠️ **două insigne diferite, nu una.** „Photo needed" spune că se
          * așteaptă o poză și nu a venit; „Photo" spune că există. Biroul se uită la ecranul ăsta
          * ca să afle care vizite mai au ceva de făcut, iar o singură insignă pentru amândouă
          * stările l-ar fi pus să deschidă fiecare rând ca să afle.
          */}
        {item.photoRequired && !item.hasPhoto && (
          <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 align-middle">
            Photo needed
          </span>
        )}
        {item.hasPhoto && (
          <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700 align-middle">
            Photo{item.photoUploadedBy ? ` · ${item.photoUploadedBy}` : ''}
          </span>
        )}
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
      <ChecklistRequiredToggle
        itemId={item.id} itemLabel={item.itemLabel} required={item.required}
        photoRequired={item.photoRequired} onSaved={onUpdate}
      />
      {item.sourceField === VISIT_EXTRA_SOURCE && !isDone && (
        <RemoveVisitPoint itemId={item.id} itemLabel={item.itemLabel} onRemoved={onUpdate} />
      )}
    </div>
  );
}

