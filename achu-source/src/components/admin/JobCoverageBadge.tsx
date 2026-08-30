/**
 * §9 „Cleaner count" (Sesiunea 160) — CÂȚI TREBUIE, CÂȚI SUNT.
 *
 * 🔴 **Ce repară:** o vizită cu UN curățător repartizat arăta identic fie că era nevoie de unul,
 * fie că mai trebuia încă unul. ⛔ „Mai lipsește cineva mâine?" nu avea răspuns pe niciun ecran —
 * stătea în capul cui a luat telefonul, iar dimineața se afla la ușă.
 *
 * ⚠️ **Propoziția vine ÎNTREAGĂ de la server.** Ecranul alege doar culoarea — aceeași regulă ca la
 * valabilitatea unei oferte: vizita se citește în listă, în dialog și în orar, iar trei texte
 * scrise separat ar ajunge să spună trei lucruri.
 *
 * ⛔ **Nu se arată nimic când nimeni n-a spus câți trebuie.** Un marcaj pe fiecare vizită veche ar
 * fi zgomot pe tot orarul, iar ochiul învață să sară exact peste locul unde apare, cândva, o lipsă.
 */
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { JobRecord } from '@/lib/adminRecordTypes';

export default function JobCoverageBadge({ coverage, className }: { coverage: JobRecord['coverage']; className?: string }) {
  if (!coverage?.label) return null;

  /**
   * ⚠️ Chihlimbar DOAR când chiar lipsește cineva. ⛔ „Mai mulți decât s-a cerut" nu e o alarmă —
   * poate fi deliberat; se arată, dar fără culoarea care cheamă la acțiune.
   */
  const lipseste = coverage.short > 0;

  return (
    <Badge
      variant="outline"
      className={`${lipseste ? 'border-amber-500 text-amber-700 dark:text-amber-400' : 'text-muted-foreground'} ${className ?? ''}`}
      title={lipseste
        ? `${coverage.short} more cleaner${coverage.short === 1 ? '' : 's'} still needed on this job`
        : `This job asks for ${coverage.needed}`}
    >
      <Users className="h-3 w-3 mr-1" />{coverage.label}
    </Badge>
  );
}

