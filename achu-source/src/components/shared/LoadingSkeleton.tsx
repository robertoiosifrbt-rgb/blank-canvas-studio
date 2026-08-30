/**
 * §48 „Loading skeletons" (Sesiunea 154) — LOCUL PĂSTRAT CÂT SE ÎNCARCĂ, ÎNTR-UN SINGUR LOC.
 *
 * ⚠️ Scris după ce șapte ecrane au primit fiecare propriul bloc de schelete: aceleași trei rânduri,
 * aceeași etichetă, aceeași grijă. ⛔ A opta copie ar fi fost prima care uită `aria-busy`, iar
 * lipsa lui nu se vede pe niciun ecran — o aude doar cine folosește un cititor de ecran.
 *
 * 🔴 **De ce contează forma, nu doar „arată ceva":** un spinner într-un card de o linie face ecranul
 * să **sară** la înălțimea lui adevărată exact când sosesc datele. Pe telefon asta mută sub deget
 * tocmai butonul pe care voiai să-l apeși.
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingSkeleton({ heights, label = 'Loading…', className }: {
  /** Înălțimile blocurilor, de sus în jos — ca scheletul să semene cu ecranul care vine. */
  heights: string[];
  /** ⚠️ Ce **aude** cineva cu cititor de ecran. Implicit „Loading…", schimbabil unde ecranul are un nume. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={className ?? 'space-y-2'} aria-busy="true" aria-label={label}>
      {heights.map((h, i) => <Skeleton key={i} className={`${h} w-full`} />)}
    </div>
  );
}

