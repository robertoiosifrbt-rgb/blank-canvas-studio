/**
 * 🔴 §7 „Estimated duration" + „Recommended cleaner count" (Sesiunea 150) — **CÂT E DE LUCRU.**
 *
 * ⛔ **Fișier propriu, nu un bloc în pagină:** `PriceCalculatorPage.tsx` e **exact** pe clichetul lui
 * de mărime, iar regula spune ce se face atunci — iese cod, cifra nu urcă (`AGENT_RULES` §7).
 *
 * ⚠️ **Ce arată, și de ce în ordinea asta:** întâi durata muncii (cifra care se hotărăște din ea e
 * fereastra vizitei), apoi ce înseamnă ea pentru 1, 2 sau 3 oameni. 🔴 **Nu recomandă un număr** —
 * motivul întreg e în `lib/duration.ts`: câți oameni se trimit e o regulă de operare, nu o
 * împărțire, iar o cifră inventată aici ar fi o decizie de business deghizată în cod.
 *
 * ⛔ **Nu apare pe oferta clientului.** O durată scrisă acolo e o promisiune, iar ce promitem în scris
 * nu se hotărăște din cod (§2).
 */
import { Clock } from 'lucide-react';
import { formatDuration, crewOptions } from '@/lib/duration';

export default function QuoteWorkloadSummary({ totalMinutes }: { totalMinutes: number }) {
  const options = crewOptions(totalMinutes);
  // ⚠️ Zero minute nu e o durată de arătat: o ofertă fără nicio poziție tarifată n-are ce spune aici.
  if (options.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        About {formatDuration(totalMinutes)} of work
      </p>
      {/* ⚠️ „One cleaner … two … three" — fapte, nu o recomandare. Cine hotărăște e biroul. */}
      <p className="text-xs text-muted-foreground">
        {options.map(o => `${o.cleaners === 1 ? 'One cleaner' : `${o.cleaners} cleaners`}: ${formatDuration(o.minutesEach)}`).join(' · ')}
      </p>
      <p className="text-[11px] text-muted-foreground/80">
        Arithmetic, not a plan — how many people go is your call. Not shown to the customer.
      </p>
    </div>
  );
}

