/**
 * §36 „Internal rating" (Sesiunea 142) — nota BIROULUI despre o vizită, pe ecranul vizitei.
 *
 * ─── 🔴 CE SPUNE ECRANUL DESPRE SINE, ȘI DE CE E OBLIGATORIU ─────────────────
 * Prima întrebare a oricui vede o a doua notă lângă cea a clientului e *„strică asta media?"*.
 * Propoziția care răspunde vine de la SERVER (`audience`) și e afișată **înainte** de a nota:
 * nota internă nu ajunge nici la client, nici la curățător, și nu intră în cifrele de satisfacție.
 *
 * ─── ⚠️ ȘI DE CE RAPOARTELE CURĂȚĂTORILOR STAU DEASUPRA CIFREI ──────────────
 * „Nu am avut destul timp" trebuie citit **înainte** de a pune o notă, nu după. Un birou care
 * notează 2 pentru o curățenie pe care nimeni nu o putea face în ora alocată judecă programarea
 * lui, nu munca omului — iar informația exista, doar era pe alt ecran.
 *
 * ⛔ **Nimic de aici nu e feedback pentru cineva.** Cine vrea să spună ceva unui om vorbește cu el;
 * asta e memoria firmei despre propria muncă.
 */
import { useEffect, useState, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Loader2, ClipboardCheck, Info } from 'lucide-react';
import { getJobInternalRating, saveJobInternalRating } from '@/lib/endpoints';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

type Payload = Awaited<ReturnType<typeof getJobInternalRating>>;

/** Cele trei întrebări, cu ce înseamnă răspunsul pentru birou. ⚠️ Aceleași cuvinte ca la curățător. */
const REPORT_QUESTIONS: { key: 'accessWorked' | 'timeEnough' | 'conditionWorseThanUsual'; label: string; badWhen: boolean }[] = [
  { key: 'accessWorked', label: 'Access worked', badWhen: false },
  { key: 'timeEnough', label: 'Enough time', badWhen: false },
  { key: 'conditionWorseThanUsual', label: 'Worse than usual', badWhen: true },
];

/** ⚠️ `null` se afișează ca „not said", niciodată ca „No": omul nu a răspuns, nu a negat. */
function answerLabel(value: boolean | null): string {
  if (value === null) return 'not said';
  return value ? 'yes' : 'no';
}

export default function JobInternalRating({ jobId }: { jobId: string }) {
  /**
   * ⚠️ **`useTrackedRequest`, ca restul ecranelor**, nu un `useState` + `useEffect` scris de mână:
   * acela punea starea **sincron într-un efect**, iar clichetul de lint al repo-ului e EXACT — un
   * singur avertisment nou sparge buildul, și se scoate avertismentul, nu se ridică pragul
   * (`AGENT_RULES` §7). Hookul face și încărcarea urmărită (loading/error/retry) pe gratis.
   */
  const req = useTrackedRequest<Payload>({ timeoutMs: 20000 });
  /**
   * 🔴 **Ce a tastat OMUL, nu o copie a răspunsului serverului.** `null` = nu a atins nimic, deci
   * se afișează ce e salvat. ⚠️ Varianta evidentă — un `useState` umplut dintr-un efect — pune
   * starea **sincron într-un efect**, iar clichetul de lint al repo-ului e EXACT: un singur
   * avertisment nou sparge buildul (`AGENT_RULES` §7). ✅ Aici valoarea se **derivă**, deci nu
   * există nicio copie care se poate învechi față de ce a întors serverul.
   */
  const [scoreTyped, setScoreTyped] = useState<number | null>(null);
  const [noteTyped, setNoteTyped] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * ⚠️ `fire` extras din obiect, nu `req.fire` în dependențe — aceeași notă ca la
   * `CustomerFeedbackPage`: `[req.fire]` produce un avertisment `exhaustive-deps`, iar `fire` e
   * deja stabil (`useCallback` în hook), deci extragerea nu schimbă nimic la execuție.
   */
  const { fire } = req;
  const load = useCallback(() => { fire(() => getJobInternalRating({ jobId })); }, [fire, jobId]);

  useEffect(() => { load(); }, [load]);

  const data = req.data;
  /** Ce se vede: ce a tastat omul, altfel ce e salvat. */
  const score = scoreTyped ?? data?.rating?.score ?? null;
  const note = noteTyped ?? data?.rating?.note ?? '';

  const save = async () => {
    if (score === null || saving) return;
    setSaving(true);
    try {
      await saveJobInternalRating({ jobId, score, note: note.trim() || null });
      toast.success('Office score saved.');
      /**
       * ⚠️ Se renunță la ce a tastat omul **după** ce s-a salvat, ca formularul să arate din nou
       * exact ce a întors serverul (lecția ACHU-292: o golire trebuie să se vadă).
       */
      setScoreTyped(null);
      setNoteTyped(null);
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (req.error) return <p className="text-xs text-destructive">{req.error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Loading…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/**
        * ⚠️ Rapoartele PRIMELE, deasupra cifrei — vezi antetul. Se arată doar când există: un bloc
        * gol „nimeni nu a spus nimic" ar împinge cifra în jos fără să adauge ceva.
        */}
      {data.cleanerReports.length > 0 && (
        <div className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />What the cleaners told us
          </div>
          {data.cleanerReports.map(r => (
            <div key={r.cleanerId} className="text-xs">
              <span className="font-medium">{r.cleanerName || 'Cleaner'}: </span>
              {REPORT_QUESTIONS.map((q, i) => {
                const value = r[q.key];
                /** 🔴 Roșu doar când răspunsul e cel care cere ceva de la birou, nu la orice „no". */
                const bad = value !== null && value === q.badWhen;
                return (
                  <span key={q.key} className={bad ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                    {i > 0 && <span className="text-muted-foreground"> · </span>}
                    {q.label}: {answerLabel(value)}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Star className="h-3.5 w-3.5" aria-hidden="true" />How well was this done?
          {data.rating && <Badge variant="secondary" className="text-[10px] font-normal">by {data.rating.ratedBy}</Badge>}
        </div>

        {/* 🔴 Propoziția care răspunde la „strică asta media clientului?". Vine de la server. */}
        <p className="text-[11px] leading-snug text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />{data.audience}
        </p>

        {!data.canRate ? (
          <p className="text-xs text-muted-foreground">{data.notRateableReason}</p>
        ) : (
          <>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  aria-label={`${s} out of 5`} title={`${s} out of 5`}
                  onClick={() => setScoreTyped(s)}
                  className="p-0.5"
                >
                  <Star className={`h-5 w-5 ${score !== null && s <= score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={note}
              maxLength={2000}
              placeholder="Skirting boards missed in the back bedroom — worth a word before the next job."
              onChange={e => setNoteTyped(e.target.value)}
              aria-label="Office note about this job"
            />
            <Button size="sm" onClick={save} disabled={saving || score === null}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
              {data.rating ? 'Update office score' : 'Save office score'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

