import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * O notă lângă câmpul care o produce (Sesiunea 157) — ÎNTR-UN SINGUR LOC.
 *
 * ─── De ce există ───────────────────────────────────────────────────────────
 *
 * ⚠️ Aceeași casetă era scrisă de **trei** ori, aproape identic: avertismentul de preferință al
 * clientului la adăugarea unui curățător, același la înlocuire (adăugat azi), și avertismentul de
 * dublură de pe formularul vizitei. ⛔ Trei copii ale aceluiași chenar se despart la prima schimbare
 * — iar atunci ecranul spune același lucru în trei feluri, ceea ce citit de un om înseamnă „sunt trei
 * lucruri diferite".
 *
 * 🔴 **Și a fost cerută de poartă, nu de gust:** verificarea de pachete a picat cu 1 kB peste plafonul
 * TOTAL după ce a apărut a treia copie (`scripts/bundle-budget.mjs`). ⛔ Pragul nu se ridică — se
 * scoate duplicarea (`AGENT_RULES` §7).
 *
 * ─── ⛔ Ce NU face ──────────────────────────────────────────────────────────
 *
 * Nu blochează nimic și nu e legată de niciun buton. ⚠️ Toate cele trei locuri care o folosesc au
 * aceeași hotărâre în spate (ACHU-554, decizia Archanei): **se avertizează, nu se refuză** — într-o
 * dimineață cu doi bolnavi, singurul curățător liber poate fi exact cel pe care clientul l-a refuzat,
 * iar două vizite într-o zi pot fi cinstite.
 */
export default function InlineNote({ tone = 'warning', children }: {
  /** `warning` — galben, „uită-te la asta" · `refusal` — roșu, „clientul a spus nu". */
  tone?: 'warning' | 'refusal';
  children: ReactNode;
}) {
  const colors = tone === 'refusal'
    ? 'bg-destructive/10 text-destructive border-destructive/30'
    : 'bg-amber-50 text-amber-800 border-amber-300';
  return (
    <div role="note" className={`rounded-md border p-2 text-xs flex items-start gap-1.5 ${colors}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

