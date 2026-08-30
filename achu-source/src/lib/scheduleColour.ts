/**
 * §11 „Colour coding by status / cleaner / service" — CE CULOARE ARE O VIZITĂ ÎN ORAR.
 *
 * ─── De ce un fișier, și de ce pur ──────────────────────────────────────────
 * ⚠️ Culorile de stare erau în `SchedulePage.tsx`, iar felia de la Sesiunea 158 a adăugat două
 * moduri noi. ⛔ Trei tabele de culori într-un ecran ar fi însemnat că nimic din alegerea culorii nu
 * se poate verifica fără să randezi pagina — iar „aceeași vizită a primit două culori" e chiar
 * defectul care se vede greu și se explică prost.
 *
 * ─── 🔴 Ce NU face, și e important ──────────────────────────────────────────
 * ⛔ **Culoarea nu poartă niciodată singura informație.** Pe modul „cleaner" sau „service" starea
 * vizitei **nu se mai vede în culoare**, deci ea rămâne scrisă în `title`-ul cardului și pe ecranul
 * vizitei. 🔴 Iar chenarele — roșu pentru dublură, violet pentru „cineva e plecat" (ACHU-797) — stau
 * **peste** orice mod: sunt avertismente, nu decor, și nu au voie să dispară fiindcă biroul a
 * schimbat un comutator de culoare.
 *
 * ⚠️ **Și modul „cleaner"/„service" cere o legendă.** O culoare fără nume nu spune nimic; ecranul o
 * desenează din `paletteFor`, nu din memorie.
 */

/** Modurile, închise. ⛔ `status` rămâne cel implicit: e singurul cu înțeles fără legendă. */
export type ColourMode = 'status' | 'cleaner' | 'service';

/**
 * Culorile de STARE, mutate aici din ecran. ⚠️ Vin de la `statusTone` pe server, care e singura
 * sursă a tonului — ziua, săptămâna și luna nu au voie să se despartă.
 */
export const TONE_CLASSES: Record<string, string> = {
  enquiry: 'bg-muted/60 text-muted-foreground border-border',
  booked: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  active: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
  review: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  done: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted/40 text-muted-foreground/70 border-border line-through',
  problem: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
};

/**
 * Paleta pentru „după om" și „după serviciu".
 *
 * ⚠️ **Opt culori, nu mai multe:** dincolo de atât, două nuanțe apropiate se citesc ca aceeași
 * culoare pe un card de 90 de pixeli, deci a noua culoare ar fi o minciună vizuală. ⛔ La mai mult
 * de opt valori, culorile se repetă — de asta legenda e obligatorie, nu opțională: ea spune care
 * nume are care culoare, iar două nume cu aceeași culoare se văd în ea.
 *
 * 🔴 **Roșul și violetul lipsesc dinadins.** Sunt culorile avertismentelor (dublură, cineva plecat),
 * iar un curățător colorat roșu ar arăta ca o vizită cu probleme.
 */
const PALETTE = [
  'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
  'bg-lime-500/15 text-lime-800 dark:text-lime-300 border-lime-500/40',
  'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
];

/** ⚠️ Când nu există valoare (vizită fără curățător, serviciu gol) — neutru, nu prima culoare. */
const NONE = 'bg-muted text-muted-foreground border-border border-dashed';

/**
 * 🔴 **Culoarea se alege din NUME, nu din poziția în listă**, și asta e regula care ține ecranul
 * stabil: cu indexul din listă, Maria ar fi albastră luni și verde marți, fiindcă ordinea vizitelor
 * se schimbă. ⛔ Un om are aceeași culoare în toată aplicația, în orice săptămână.
 *
 * ⚠️ Suma e deliberat banală (nu criptografică): singurul lucru cerut e să fie **aceeași** de fiecare
 * dată pentru același text.
 */
function indexFor(key: string): number {
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum = (sum + key.charCodeAt(i) * (i + 1)) % 100_000;
  return sum % PALETTE.length;
}

export function colourForKey(key: string | null | undefined): string {
  const trimmed = key?.trim();
  if (!trimmed) return NONE;
  return PALETTE[indexFor(trimmed)];
}

/** Ce cheie colorează vizita, în modul dat. `null` = n-are valoare, deci se desenează neutru. */
export function keyForEntry(
  entry: { tone: string; service: string | null; cleaners: { name: string }[] },
  mode: ColourMode,
): string | null {
  if (mode === 'cleaner') {
    /**
     * ⚠️ **Primul curățător, la o vizită cu doi**, și e o limită scrisă, nu ascunsă: un card nu poate
     * avea două culori de fond. ⛔ Numele tuturor rămân pe card, dedesubt, deci nimeni nu dispare.
     */
    return entry.cleaners[0]?.name ?? null;
  }
  if (mode === 'service') return entry.service ?? null;
  return entry.tone;
}

/** Clasele cardului pentru o vizită, în modul dat. */
export function classesForEntry(
  entry: { tone: string; service: string | null; cleaners: { name: string }[] },
  mode: ColourMode,
): string {
  if (mode === 'status') return TONE_CLASSES[entry.tone] ?? TONE_CLASSES.booked;
  return colourForKey(keyForEntry(entry, mode));
}

/**
 * Legenda: fiecare valoare din perioada privită, cu culoarea ei, în ordine alfabetică.
 *
 * ⚠️ **Doar ce e pe ecran acum**, nu toți curățătorii firmei: o legendă cu treizeci de nume, din care
 * doi lucrează săptămâna asta, e o listă pe care nimeni n-o citește. ⛔ „Fără curățător" apare ca rând
 * propriu când există astfel de vizite — altfel culoarea neutră ar fi un mister.
 */
export function legendFor(
  entries: { tone: string; service: string | null; cleaners: { name: string }[] }[],
  mode: ColourMode,
): { label: string; classes: string }[] {
  if (mode === 'status') return [];
  const names = new Set<string>();
  let hasNone = false;
  for (const e of entries) {
    const key = keyForEntry(e, mode)?.trim();
    if (key) names.add(key); else hasNone = true;
  }
  const rows = [...names].sort((a, b) => a.localeCompare(b)).map(label => ({ label, classes: colourForKey(label) }));
  if (hasNone) rows.push({ label: mode === 'cleaner' ? 'No cleaner' : 'No service', classes: NONE });
  return rows;
}

