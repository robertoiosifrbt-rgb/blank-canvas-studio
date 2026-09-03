/**
 * §16 „Customer-visible completion summary" (Sesiunea 143) — ce i se spune clientului despre
 * checklistul unei vizite încheiate.
 *
 * ─── 🔴 CIFRE, NU LISTA — ȘI DE CE ──────────────────────────────────────────
 * „12 din 12 lucruri făcute" răspunde la întrebarea pe care o are omul: *s-a făcut tot?* ⛔ **Lista
 * de puncte nu vine de la server și nu se afișează:** etichetele sunt interne, iar arătate
 * clientului ar deveni o promisiune contractuală — fiecare punct pe care biroul îl scoate ar arăta
 * ca un serviciu retras. ⚠️ Un cuvânt de la un owner și se poate deschide.
 *
 * ─── ⚠️ SE ÎNCARCĂ DOAR CÂND E NEVOIE ──────────────────────────────────────
 * Portalul arată zeci de vizite; o cerere per card, la fiecare deschidere a listei, ar fi zeci de
 * cereri pentru o linie de text. Componenta cere sumarul **o dată**, la montare, și **numai** pe o
 * vizită încheiată — pe restul nu atinge rețeaua deloc.
 *
 * ⛔ **Tace când nu are ce spune.** Vizită fără checklist → nimic pe ecran, nu „0 din 0". O cerere
 * căzută → tot nimic: un mesaj de eroare pentru o linie informativă ar speria degeaba pe cineva
 * care se uită la o curățenie de luna trecută.
 */
import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { getMyJobChecklistSummary } from '@/lib/endpoints';

export default function ChecklistSummary({ jobId }: { jobId: string }) {
  const [summary, setSummary] = useState<{ done: number; skipped: number; total: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await getMyJobChecklistSummary({ jobId });
        if (alive && res.available) setSummary({ done: res.done, skipped: res.skipped, total: res.total });
      } catch {
        /**
         * ⛔ Înghițit deliberat, și e singurul loc din portal unde fac asta: linia e informativă,
         * iar un card de istoric care ar afișa „nu am putut încărca" pentru ea ar arăta ca o
         * problemă la vizita însăși. Ce nu se încarcă, nu se arată.
         */
      }
    })();
    return () => { alive = false; };
  }, [jobId]);

  if (!summary) return null;

  const all = summary.skipped === 0 && summary.done >= summary.total;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ListChecks className={`h-3.5 w-3.5 shrink-0 ${all ? 'text-emerald-600' : ''}`} aria-hidden="true" />
      {/**
        * ⚠️ Propoziție, nu „12/12": clientul citește o frază, nu o fracție. Iar când e tot, se
        * spune „everything" — cifra egală cu totalul nu se citește la fel de repede ca cuvântul.
        */}
      <span>
        {all
          ? `Everything on the plan for this job was done (${summary.total} ${summary.total === 1 ? 'item' : 'items'}).`
          : `${summary.done} of ${summary.total} items on the plan for this job were done.`}
        {/**
          * 🔴 **Punctele pe care nu s-a putut lucra se spun, nu se ascund** — și asta e o CORECTURĂ
          * a primei variante din aceeași sesiune, nu o funcționalitate nouă. ⚠️ Atunci steagul „nu
          * se aplică" nu putea fi pus de nimeni, deci a-l număra ca făcut era inofensiv; acum
          * curățătorul îl pune (felia „Failure reason"), deci aceeași sumă ar fi spus „s-a făcut
          * tot" despre o vizită în care ceva NU s-a făcut.
          *
          * ⛔ **Motivul nu se afișează**, deși există: e text scris de un curățător despre casa
          * cuiva. ✅ Fraza îl trimite pe om unde răspunsul e dat de o persoană — biroul îl are pe
          * ecran. ⚠️ Alternativa (să nu se spună nimic) ar fi ținut ecranul liniștit exact până
          * când clientul observă singur, adică minciuna în direcția cea mai scumpă.
          */}
        {summary.skipped > 0 && (
          ` ${summary.skipped} ${summary.skipped === 1 ? 'item could' : 'items could'} not be done on the day — ask us and we will tell you why.`
        )}
      </span>
    </p>
  );
}

