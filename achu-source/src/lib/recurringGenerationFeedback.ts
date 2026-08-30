/**
 * CE I SE SPUNE BIROULUI DUPĂ O RULARE DE CONTRACT RECURENT.
 *
 * 🔴 **De ce e un fișier și nu două blocuri de `toast`:** generarea se apasă din **două** locuri
 * — lista de contracte și dialogul unui contract — iar până acum fiecare își compunea singur
 * mesajul. La ACHU-700 a apărut ceva ce **trebuie** spus în amândouă (curățători reținuți
 * fiindcă nu mai sunt activi), și un al doilea loc de scris aceeași propoziție e chiar felul în
 * care ecranele ajung să spună lucruri diferite despre același răspuns.
 *
 * ⚠️ Partea care decide **ce** se spune e pură și testabilă (`generationMessages`); doar
 * afișarea atinge `sonner`.
 */
import { toast } from 'sonner';
import type { GenerateVisitsResponse } from './recurringSeriesEndpoints';

export type GenerationMessages = {
  /** `info` când nu s-a adăugat nimic — nu e o eroare, dar nici o izbândă. */
  kind: 'info' | 'success';
  title: string;
  description?: string;
  /**
   * 🔴 Propozițiile care nu sunt un detaliu, ci o **sarcină**: vizitele există, dar ceva despre ele
   * cere o apăsare de la om. ACHU-700 — curățători inactivi, deci vizite neasignate. ACHU-604/703/733
   * — rularea s-a oprit în mijloc.
   *
   * ⚠️ **O listă, nu un câmp.** Cele două se pot întâmpla pe aceeași rulare, iar un singur câmp ar
   * fi însemnat că a doua cauză o ascunde pe prima — exact felul în care biroul află doar jumătate.
   */
  warnings: string[];
};

/**
 * @param compact dialogul unui contract are deja orizontul pe ecran, sub buton — repetat în
 *                toast ar fi zgomot. Lista nu-l are, deci acolo se spune.
 */
export function generationMessages(res: GenerateVisitsResponse, compact = false): GenerationMessages {
  const withheld = res.withheldCleaners ?? [];
  const cleanerWarning = withheld.length
    // ⛔ Pe nume și cu ce trebuie făcut. „Unii curățători au fost săriți" ar fi lăsat biroul să
    // caute care și de ce, exact în ziua în care nu are timp.
    ? `${withheld.join(', ')} ${withheld.length === 1 ? 'is' : 'are'} no longer active and ${withheld.length === 1 ? 'was' : 'were'} not put on the new jobs. Assign somebody else.`
    : undefined;

  /**
   * 🔴 ACHU-604/703/733 — oprirea e un AVERTISMENT, nu o descriere.
   *
   * ⛔ `description` n-ar fi ajuns: în dialog (`compact`) nu se afișează deloc, iar pe o rulare
   * oprită la prima vizită nici nu se ajunge acolo. ⚠️ Iar biroul trebuie să afle acum — a cerut
   * vizite până la o dată și n-a primit până acolo, iar cauza nu e pe niciun ecran.
   */
  const stopWarning = res.stoppedBecause
    ? `Somebody set this contract to ${res.stoppedBecause} while the jobs were being created, so `
      + `generation stopped there. The ${res.created} job(s) already created were kept. `
      + `${res.stoppedBecause === 'paused' ? 'Resume it' : 'Create a new contract'} to book the rest.`
    : undefined;

  const warnings = [stopWarning, cleanerWarning].filter((w): w is string => w !== undefined);

  if (res.created === 0) {
    // Not an error, and not a silent no-op either: pressing a button and
    // getting nothing back is how people conclude a feature is broken.
    // ⛔ Iar „already booked up to that date" pe o rulare OPRITĂ ar fi o minciună: nu e rezervat
    // până acolo, tocmai de asta nu s-a creat nimic.
    if (res.stoppedBecause) return { kind: 'info', title: 'Generation stopped — no jobs added.', warnings };
    return compact
      ? { kind: 'info', title: 'Already booked up to that date', warnings }
      : { kind: 'info', title: 'Already booked up to that date — nothing new to add.', warnings };
  }

  return {
    kind: 'success',
    title: compact
      ? `${res.created} job(s) added`
      : `${res.created} job${res.created === 1 ? '' : 's'} added to the diary`,
    description: compact ? undefined : res.note ?? `Booked up to ${res.horizon}.`,
    warnings,
  };
}

/** Aceleași mesaje, pe ecran. ⚠️ Avertismentele stau mai mult: sunt sarcini, nu confirmări. */
export function showGenerationOutcome(res: GenerateVisitsResponse, compact = false): void {
  const m = generationMessages(res, compact);
  if (m.kind === 'info') toast.info(m.title);
  else toast.success(m.title, m.description ? { description: m.description } : undefined);
  for (const w of m.warnings) toast.warning(w, { duration: 10000 });
}

