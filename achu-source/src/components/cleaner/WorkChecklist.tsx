import { useState, useEffect, useCallback, useRef } from 'react';
import { getJobChecklist, updateJobChecklistItem, GetJobChecklistOutputType } from '@/lib/endpoints';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ClipboardCheck, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// §16 (Sesiunea 143) — unde omul SCRIE nota. Câmpul se afișa deja mai jos, dar nu se putea scrie.
import ChecklistItemNote from './ChecklistItemNote';
// §16 (Sesiunea 143) — unde omul spune DE CE nu s-a putut face. Câmpul se afișa deja, ca și nota.
import ChecklistItemSkip from './ChecklistItemSkip';
/**
 * §16 (Sesiunea 144) — camera. ⛔ Apare DOAR pe punctele pe care biroul le-a marcat „cere poză":
 * un buton pe fiecare rând ar fi deschis un canal prin care se adună poze din casele oamenilor
 * fără ca nimeni să fi cerut vreuna.
 */
import ChecklistItemPhoto from './ChecklistItemPhoto';
import { errMsg } from '@/lib/errorMessage';
/**
 * §16 „Room-based sections" (Sesiunea 144) — a doua citire a ACELEIAȘI liste. Regula (ce e o
 * cameră și ce nu) stă în `lib`, pură și testată fără ecran.
 */
import { groupChecklistByRoom } from '@/lib/checklistRoomGroups';

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

/**
 * Unde se ține alegerea „pe cameră / pe serviciu".
 *
 * ⚠️ **Se ține minte între vizite, nu doar în pagină:** un curățător care lucrează cameră cu cameră
 * o face la fiecare casă, iar un comutator care se resetează la fiecare deschidere de listă e un
 * comutator pe care îl apeși de zece ori pe zi. ⛔ `localStorage` poate lipsi (mod privat, telefon
 * blocat), deci fiecare atingere a lui e într-un `try` — o preferință pierdută nu are voie să
 * doboare lista de lucru.
 */
const VIEW_KEY = 'achu.checklistView';

function readView(): 'service' | 'room' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'room' ? 'room' : 'service';
  } catch {
    return 'service';
  }
}

export default function WorkChecklist({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  /**
   * ⛔ **„Pe serviciu" rămâne PORNIREA**, deși „pe cameră" e mai bună pentru picioare: ea e ordinea
   * în care munca a fost vândută și în care biroul o citește, iar o listă care își schimbă singură
   * forma pentru toată lumea e o surpriză, nu o îmbunătățire. ✅ Cine o alege, o păstrează.
   */
  const [view, setView] = useState<'service' | 'room'>(readView);
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

  /**
   * 🔴 **Aceleași puncte, doar altfel grupate** — nicio cerere în plus și nicio scriere: regruparea
   * e o funcție pură peste ce e deja pe ecran. ⚠️ De asta comutatorul e instant chiar și fără semnal.
   */
  const visibleGroups = data?.hasChecklist
    ? (view === 'room' ? groupChecklistByRoom(data.groups.flatMap(g => g.items)) : data.groups)
    : [];

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
          {data?.hasChecklist && data.groups.length > 0 && (
            /**
             * ⚠️ Comutatorul stă SUS, deasupra listei, nu în vreun meniu: e o alegere pe care omul o
             * face o dată și apoi o uită. ⛔ Nu apare pe o vizită fără checklist — un comutator care
             * regrupează nimic e doar un buton care nu face nimic.
             */
            <div className="flex items-center gap-1 px-1" role="group" aria-label="How to group the checklist">
              {([['service', 'By service'], ['room', 'By room']] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => {
                    setView(v);
                    try { localStorage.setItem(VIEW_KEY, v); } catch { /* o preferință pierdută nu doboară lista */ }
                  }}
                  className={`min-h-[36px] rounded-full border px-3 text-[11px] ${
                    view === v ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {data?.hasChecklist && visibleGroups.map((group) => (
            <ChecklistGroupSection key={group.groupName} group={group} byRoom={view === 'room'} onUpdate={load} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChecklistGroupSection({ group, byRoom, onUpdate }: {
  group: { groupName: string; items: ChecklistItem[] };
  byRoom: boolean;
  onUpdate: () => void;
}) {
  const done = group.items.filter(i => i.completed || i.notApplicable).length;
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
        {group.groupName}
        <span className="text-[10px] font-normal">{done}/{group.items.length}</span>
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => (
          <ChecklistItemRow key={item.id} item={item} byRoom={byRoom} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

function ChecklistItemRow({ item, byRoom, onUpdate }: { item: ChecklistItem; byRoom: boolean; onUpdate: () => void }) {
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
    } catch (e) {
      if (mountedRef.current) toast.error(errMsg(e) || 'Failed to update');
    } finally {
      if (mountedRef.current) setSaving(false);
      setTimeout(() => { debounceRef.current = false; }, 300);
    }
  };

  const isDone = item.completed || item.notApplicable;
  /**
   * 🔴 **În citirea pe cameră, titlul grupului E eticheta punctului**, deci pe rând se scrie
   * SERVICIUL. ⛔ Altfel „Bedroom 1" ar fi apărut de trei ori sub titlul „Bedroom 1", iar omul nu ar
   * fi avut de unde să știe care rând e curățenia de bază și care e aburul.
   *
   * ⚠️ Și butoanele de notă și de „nu s-a putut" primesc ACELAȘI text, nu eticheta din bază: ce
   * citește un cititor de ecran trebuie să fie ce vede omul pe rândul de deasupra degetului.
   */
  const title = byRoom ? item.groupName : item.itemLabel;
  const fmtTime = item.completedAt
    ? new Date(item.completedAt).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    /**
     * ⚠️ §16 — rândul e un `div` cu TREI suprafețe de atins: bifatul (ca înainte, tot rândul), „nu
     * s-a putut" și nota. ⛔ Un buton într-un buton nu e HTML valid, iar o apăsare pe el ar fi bifat
     * punctul — adică exact opusul a ce voia omul. ⚠️ Bifatul rămâne cel lat; celelalte două sunt
     * mici și laterale, ca să nu concureze cu ce se face de zeci de ori pe zi.
     */
    <div className={`w-full flex flex-wrap items-center rounded-md transition-colors ${isDone ? 'opacity-60' : ''}`}>
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`flex-1 min-w-0 flex items-center gap-3 min-h-[44px] px-2 py-1.5 rounded-md transition-colors text-left ${
        isDone ? '' : 'hover:bg-muted/60'
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
          {title}
          {/**
            * 🔴 §16 „Optional checklist items" (Sesiunea 144) — **curățătorul trebuie să vadă care
            * puncte nu-l opresc.**
            *
            * ⚠️ Fără insigna asta, mecanismul ar exista doar pe ecranul biroului: omul din casă ar
            * încerca să bifeze tot, iar cele opționale ar arăta ca muncă restantă. ⛔ Și e chiar
            * ceea ce înlocuiește obiceiul greșit — până acum singurul fel de a trece peste un
            * punct de care nu era nevoie era să-l marcheze „nu s-a putut", iar aceea e o
            * propoziție care ajunge la CLIENT.
            *
            * ⚠️ Se marchează doar excepția (ca pe ecranul biroului): „Required" pe fiecare rând ar
            * fi tapet pe un ecran de telefon, unde fiecare cuvânt costă un rând. ⚠️ Și rămâne
            * lipită de TITLU, nu de eticheta din bază — în citirea pe cameră titlul e serviciul.
            */}
          {!item.required && (
            <span className="ml-1.5 rounded bg-background px-1 py-0.5 text-[10px] text-muted-foreground align-middle">
              Optional
            </span>
          )}
          {/**
            * §16 (Sesiunea 144) — ⚠️ **spune ce lipsește, nu ce se cere.** „Photo needed" pe un punct
            * care are deja poza ar fi trimis omul să o facă din nou; bifa verde de pe butonul de
            * cameră e cea care confirmă. ⛔ Deci insigna dispare când poza există.
            */}
          {item.photoRequired && !item.hasPhoto && (
            <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 align-middle">
              Photo needed
            </span>
          )}
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
      {item.photoRequired && (
        <ChecklistItemPhoto itemId={item.id} itemLabel={title} hasPhoto={item.hasPhoto} onSaved={onUpdate} />
      )}
      <ChecklistItemSkip itemId={item.id} itemLabel={title} notApplicable={item.notApplicable} onSaved={onUpdate} />
      <ChecklistItemNote itemId={item.id} itemLabel={title} note={item.notes} onSaved={onUpdate} />
    </div>
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

