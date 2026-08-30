/**
 * §17 (Sesiunea 154) — CÂT S-A ABĂTUT VIZITA DE LA FEREASTRA EI, pe ecran.
 *
 * ⚠️ **Un singur loc, trei ecrane** (tabelul de vizite, cardul de telefon, dialogul vizitei):
 * altfel aceeași abatere ar fi fost scrisă în trei feluri, iar al patrulea ecran ar fi copiat pe
 * unul din ele. ⛔ Nimic nu se decide aici — codurile și cifrele vin de la server
 * (`backend/src/lib/jobScheduleFlags.ts`), fișierul acesta le dă doar un cuvânt și o culoare.
 *
 * 🔴 **Culorile nu spun „vină".** Chihlimbar pentru cele două care ating promisiunea făcută
 * clientului (a ajuns târziu, a plecat mai devreme), neutru pentru depășire: o vizită care s-a
 * lungit poate fi chiar munca făcută cum trebuie. ⛔ Roșu nu apare pe niciunul — ar fi transformat
 * o măsurătoare într-o acuzație, iar `AGENT_RULES` §2 spune cine are voie să facă asta.
 */
import type { JobRecord } from '@/lib/adminRecordTypes';

type Flag = NonNullable<JobRecord['scheduleFlags']>[number];

/** Cuvântul scurt de pe chip. ⚠️ Mesajul întreg (cu cifra) rămâne în `title`, scris de server. */
const LABEL: Record<Flag['code'], string> = {
  'late-start': 'Late start',
  'early-finish': 'Early finish',
  overran: 'Overran',
};

const TONE: Record<Flag['code'], string> = {
  'late-start': 'bg-amber-100 text-amber-800',
  'early-finish': 'bg-amber-100 text-amber-800',
  overran: 'bg-slate-100 text-slate-700',
};

export function ScheduleFlagBadges({ flags, className = '' }: { flags: Flag[] | undefined; className?: string }) {
  if (!flags?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {flags.map(f => (
        <span
          key={f.code}
          title={f.message}
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE[f.code]}`}
        >
          {LABEL[f.code]}
        </span>
      ))}
    </span>
  );
}

