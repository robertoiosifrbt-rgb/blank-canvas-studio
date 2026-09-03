/**
 * 🔴 §7 „Estimated duration" + „Recommended cleaner count" (Sesiunea 150) — **CÂT DUREAZĂ MUNCA, ȘI
 * CE ÎNSEAMNĂ ASTA PENTRU 1, 2 SAU 3 OAMENI.**
 *
 * ─── Ce lipsea ───────────────────────────────────────────────────────────────
 *
 * Calculatorul de preț **calcula deja** minutele fiecărei poziții și le aduna (`totalMinutes`), iar
 * ecranul arăta minutele **pe rând**. ⛔ Totalul nu apărea nicăieri: cine cotează vedea patru
 * numere mici și niciunul care spune „treaba asta ține o dimineață". ⚠️ Iar aceea e chiar cifra din
 * care se hotărăște ce fereastră se dă vizitei și câți oameni se trimit.
 *
 * ─── 🔴 CE NU FACE, ȘI DE CE E O ALEGERE, NU O LIPSĂ ─────────────────────────
 *
 * ⛔ **Nu recomandă un număr de oameni.** „Câți curățători se trimit" e o regulă de operare — cât
 * timp stă un om într-o casă, câți încap fără să se încurce — iar o cifră inventată de mine ar fi
 * fost o decizie de business deghizată în cod (`AGENT_RULES` §8, aceeași notă care ține categoriile
 * de servicii ca text liber).
 *
 * ✅ **Ce face: aritmetica, pe față.** „4h 30m de muncă; unul singur o face în 4h 30m, doi în 2h 15m,
 * trei în 1h 30m." ⚠️ Niciun număr nou nu e inventat: e împărțire cu numerele pe care biroul le-a pus
 * deja. 🔴 Iar dacă owner-ul dă vreodată o regulă („nu trimitem un om la mai mult de 5 ore"), ea intră
 * într-un singur loc — aici — și devine o recomandare adevărată.
 *
 * ⛔ **Și nu ajunge pe oferta CLIENTULUI.** O durată scrisă acolo e o promisiune („venim 4h 30m"), iar
 * ce promitem în scris nu se hotărăște din cod (§2). Cifra rămâne pentru birou.
 */

/**
 * `4h 30m`, `45m`, `2h`. ⚠️ Ore și minute, nu minute goale: „270" nu se citește, „4h 30m" se citește.
 *
 * ⛔ **Mutată din `SchedulePage.tsx`** (Sesiunea 150), unde era scrisă pentru golurile din ziua unui
 * curățător. ⚠️ A doua copie ar fi fost singura cale prin care aceeași durată se poate scrie diferit
 * pe două ecrane.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type CrewOption = {
  /** Câți oameni. */
  cleaners: number;
  /** Cât ține vizita cu atâția oameni, în minute. */
  minutesEach: number;
};

/**
 * Cât ține vizita cu 1, 2, … `maxCrew` oameni.
 *
 * ⚠️ **Rotunjit în SUS la minut:** o fereastră mai scurtă decât munca nu e o fereastră, e o
 * întârziere planificată. ⛔ Zero minute de muncă întoarce o listă goală — nu e nimic de împărțit,
 * iar „0 oameni" ar fi o propoziție fără sens.
 *
 * ⚠️ **Trei, ca plafon de AFIȘARE**, nu ca regulă: peste trei oameni în aceeași casă aritmetica nu
 * mai e constrângerea, iar cine planifică știe asta mai bine decât un calcul.
 */
export function crewOptions(totalMinutes: number, maxCrew = 3): CrewOption[] {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return [];
  const options: CrewOption[] = [];
  for (let cleaners = 1; cleaners <= Math.max(1, maxCrew); cleaners++) {
    options.push({ cleaners, minutesEach: Math.ceil(totalMinutes / cleaners) });
  }
  return options;
}

