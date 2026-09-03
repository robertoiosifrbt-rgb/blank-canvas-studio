/**
 * O alegere de interfață ținută minte **pe dispozitiv** — citirea și scrierea, într-un singur loc.
 *
 * ─── ⛔ De ce un fișier propriu ──────────────────────────────────────────────
 * Regulile astea două existau deja, scrise de mână în `useTheme.ts`: *citirea nu are voie să arunce*
 * (unele moduri private refuză `localStorage`) și *o valoare necunoscută se ignoră*. ⚠️ A doua ecran
 * care ține minte o alegere le-ar fi rescris — iar copia rămasă în urmă n-ar fi dat nicio eroare, doar
 * s-ar fi purtat altfel în modul privat. 🔴 Deci s-au **mutat**, nu s-au rescris.
 *
 * ─── 🔴 CE POATE STA AICI, ȘI CE NU ─────────────────────────────────────────
 * ✅ Numai alegeri de **prezentare**: ce temă, ce perioadă, ce coloană. Acelea nu spun nimic despre
 * niciun om.
 * ⛔ **Niciun nume, nicio adresă, nimic dintr-un formular.** Hotărârea e scrisă la §22 („Recent
 * searches") și o poartă `useUnsavedGuard.ts`: pe un calculator de birou folosit de mai mulți oameni,
 * `localStorage` ar fi lăsat numele unui client pentru următorul care se așază. Aceea folosește
 * `sessionStorage` **dinadins**, și nu se mută aici.
 */

/**
 * ⚠️ Citirea nu are voie să arunce: în modul privat al unor browsere, simplul acces la `localStorage`
 * dă eroare, iar un ecran care se prăbușește la deschidere e mai rău decât unul care uită o alegere.
 * ⛔ Și nu întoarce niciodată o valoare din afara listei: o cheie rămasă de la o versiune veche (o
 * perioadă redenumită) ar ajunge altfel direct în cererea către server.
 */
export function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/** ⚠️ La fel: dacă scrierea e refuzată, alegerea ține pentru sesiunea asta și nu se ține minte. */
export function writeChoice(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Nimic de făcut: alegerea s-a aplicat, doar nu se va ține minte. */
  }
}

