/**
 * §4 „Customer onboarding" (Sesiunea 160) — E PUS PE PICIOARE CLIENTUL ĂSTA?
 *
 * 🔴 **Ce rezolvă:** o fișă se face în zece secunde, cu un nume și un telefon. Restul — adresa,
 * casa, consimțămintele — se completează „când ajungem la ea", iar lipsa se descoperă în cea mai
 * proastă clipă: curățătorul e la ușă și nu are cod poștal.
 *
 * 🔴 **NU E O REGULĂ ȘI NU BLOCHEAZĂ NIMIC**, iar ecranul o spune în scris. ⛔ Fără propoziția aia,
 * o listă cu bife roșii s-ar fi citit ca o cerință a firmei — pe care n-a hotărât-o nimeni.
 *
 * ⚠️ **Fiecare rând spune ce NU poate face aplicația fără el** — un fapt măsurabil, nu o mustrare.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import { getCustomerOnboarding, type OnboardingStep } from '@/lib/customerOnboardingEndpoints';

export default function CustomerOnboardingSection({ customerId }: { customerId: string }) {
  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [missing, setMissing] = useState(0);

  useEffect(() => {
    getCustomerOnboarding(customerId)
      .then(d => { setSteps(d.steps); setMissing(d.missing); })
      .catch(() => setSteps([]));
  }, [customerId]);

  if (steps === null || steps.length === 0) return null;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <ClipboardList className="h-4 w-4" /> Setting them up
        {missing > 0 && <span className="text-xs font-normal text-muted-foreground">({missing} still missing)</span>}
      </h4>

      {/*
        🔴 Propoziția care ține lista onestă. ⛔ Nimic nu se refuză pentru o fișă incompletă — „ce
        cerem unui client nou" ar fi o hotărâre a owner-ului, nu a aplicației.
      */}
      <p className="text-xs text-muted-foreground">
        Nothing here is required and nothing is blocked — a new lead with just a phone number is
        perfectly normal. Each line says what the app <strong>cannot do</strong> without it.
      </p>

      <ul className="space-y-1.5">
        {steps.map(s => (
          <li key={s.key} className="flex items-start gap-2 text-sm">
            {s.done
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="done" />
              : <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-label="not yet" />}
            <span className="min-w-0">
              <span className={s.done ? 'text-muted-foreground line-through' : ''}>{s.label}</span>
              {/* ⚠️ Motivul se arată doar la ce lipsește: repetat pe fiecare rând, nu l-ar mai citi nimeni. */}
              {!s.done && <span className="block text-xs text-muted-foreground">{s.matters}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

