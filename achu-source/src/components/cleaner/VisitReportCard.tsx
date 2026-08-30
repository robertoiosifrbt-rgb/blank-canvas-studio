/**
 * §36 „Cleaner rating of job" (Sesiunea 142) — CE SPUNE OMUL CARE A FOST ACOLO.
 *
 * ─── 🔴 DECIZIA PROPRIETARULUI, 19/08/2026: DESPRE MUNCĂ, NU DESPRE CLIENT ───
 * Trei întrebări despre **cum a mers treaba**, niciuna despre persoană, și **niciun câmp de text
 * liber** — acolo ar reintra părerea despre om pe ușa din dos, iar odată scrisă e data personală a
 * clientului, pe care i-o dăm dacă o cere. ⚠️ Textul liber al curățătorului există deja și are
 * casa lui: notele de finalizare, chiar mai sus pe acest card.
 *
 * ─── ⚠️ TREI STĂRI, NU DOUĂ ──────────────────────────────────────────────────
 * Yes / No / **nu am spus**. `null` nu e „no": un „no" implicit ar trimite biroul să repare o ușă
 * care funcționează. De aceea fiecare întrebare are trei butoane, iar cel apăsat se poate anula.
 *
 * ✅ **Textul spune cine citește, înainte de a răspunde** — regula de la instrucțiunile de acces
 * (ACHU-239): cine răspunde merită să știe unde ajunge răspunsul, iar asta e și ce-l face să
 * răspundă util. Propoziția vine de la server? Nu: e a ecranului, dar e ACEEAȘI frază ca în
 * politică (`cleanerVisitReportPolicy.ts` — `VISIT_REPORT_AUDIENCE`), ca să nu existe două.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquareCheck, Loader2, Info } from 'lucide-react';
import { saveVisitReport } from '@/lib/endpoints';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

type Answer = boolean | null;
type Field = 'accessWorked' | 'timeEnough' | 'conditionWorseThanUsual';

/**
 * ⚠️ Întrebările sunt scrise ca omul să răspundă în două secunde, pe telefon, la sfârșitul unei
 * zile de muncă. ⛔ Nu „evaluați accesul": *„Did you get in OK?"*.
 */
const QUESTIONS: { key: Field; question: string }[] = [
  { key: 'accessWorked', question: 'Did you get in OK?' },
  { key: 'timeEnough', question: 'Was there enough time?' },
  { key: 'conditionWorseThanUsual', question: 'Was the place worse than usual?' },
];

/** Aceeași frază ca `VISIT_REPORT_AUDIENCE` din politică — o singură formulare, două locuri. */
const AUDIENCE =
  'Only the office sees this. It is about the job, not about the customer — it helps us fix access '
  + 'problems and give you enough time next job.';

export default function VisitReportCard({ jobId, initial }: {
  jobId: string;
  /** Ce a răspuns deja, dacă a răspuns. ⚠️ `undefined` = nu s-a încărcat nimic pentru vizita asta. */
  initial?: Partial<Record<Field, Answer>>;
}) {
  const [answers, setAnswers] = useState<Partial<Record<Field, Answer>>>(initial ?? {});
  const [saving, setSaving] = useState<Field | ''>('');

  /**
   * ⚠️ **Se salvează la fiecare atingere, nu la un buton „Save".** Trei întrebări cu un buton de
   * salvare la sfârșit sunt trei răspunsuri pierdute când cineva închide telefonul — iar fiecare
   * atingere e deja o cerere completă, fiindcă cheia absentă înseamnă „nu atinge".
   */
  const answer = async (field: Field, value: Answer) => {
    if (saving) return;
    const next = answers[field] === value ? null : value;
    setSaving(field);
    try {
      await saveVisitReport({ jobId, [field]: next });
      setAnswers(a => ({ ...a, [field]: next }));
    } catch (e) {
      toast.error(errMsg(e) || 'Could not send that. Please try again.');
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <MessageSquareCheck className="h-4 w-4" aria-hidden="true" />How did this one go?
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />{AUDIENCE}
      </p>

      {QUESTIONS.map(q => {
        const value = answers[q.key] ?? null;
        return (
          <div key={q.key} className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm">{q.question}</span>
            <div className="flex gap-1">
              {/**
                * ⚠️ Butonul apăsat din nou **anulează** răspunsul: cineva care a atins greșit pe
                * telefon trebuie să poată reveni la „nu am spus", nu doar la celălalt răspuns.
                */}
              <Button
                size="sm"
                variant={value === true ? 'default' : 'outline'}
                className="min-h-[36px] px-3"
                disabled={saving !== ''}
                onClick={() => void answer(q.key, true)}
              >
                {saving === q.key && value !== true && <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />}Yes
              </Button>
              <Button
                size="sm"
                variant={value === false ? 'default' : 'outline'}
                className="min-h-[36px] px-3"
                disabled={saving !== ''}
                onClick={() => void answer(q.key, false)}
              >
                No
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

