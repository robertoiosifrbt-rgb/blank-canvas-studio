/**
 * Etichetele de dată ale orarului — ÎNTR-UN SINGUR LOC (ACHU-787, mutate aici la ACHU-797).
 *
 * ⚠️ **`timeZone: 'UTC'` e ales dinadins, și e opusul reparației din `format.tsx`:** ziua se
 * construiește la miezul nopții UTC, deci ora din ea e o ficțiune — doar ziua contează, iar citită pe
 * alt fus ar putea aluneca cu una. ⛔ De aceea fusul stă **aici**, nu la fiecare apelant: era scris de
 * trei ori, iar al patrulea apelant l-ar fi putut uita.
 *
 * 🔴 **De ce a plecat din `SchedulePage.tsx`:** cardul de avertismente a fost extras (ACHU-797) și îi
 * trebuia `dayLabel`. ⛔ O a doua copie acolo ar fi rupt exact ce a reparat ACHU-787 — două ecrane
 * care scriu aceeași zi în două feluri. ⚠️ Fișierul e mic dinadins: n-are voie să adune și randare,
 * altfel nu-l mai poate importa nimeni fără să tragă un ecran după el.
 */
const dayAs = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/** „Mie 29 iul" — capul unei coloane de zi. */
export const dayLabel = (iso: string) => dayAs(iso, { weekday: 'short', day: 'numeric', month: 'short' });

/** „Miercuri, 29 iulie 2026" — titlul unei singure zile, unde e loc. */
export const longDayLabel = (iso: string) => dayAs(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** „iulie 2026" — titlul lunii. */
export const monthLabel = (iso: string) => dayAs(iso, { month: 'long', year: 'numeric' });

