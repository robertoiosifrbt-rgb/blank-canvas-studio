/**
 * §48 „Consistent page titles" (Sesiunea 148) — **CE SCRIE ÎN TAB-UL BROWSERULUI.**
 *
 * ─── 🔴 CE ERA, ȘI PE CINE COSTA ────────────────────────────────────────────────────────────
 * Un singur titlu, scris în `index.html`: **„ACHU Business Hub"**, pe toate cele ~50 de ecrane.
 * ⛔ Consecințele nu sunt estetice:
 *
 *   1. **Biroul lucrează cu multe tab-uri deschise** (vizitele într-unul, plățile în altul). Toate
 *      arătau identic, deci alegerea tab-ului se făcea prin încercări.
 *   2. 🔴 **Un cititor de ecran anunță titlul paginii la fiecare navigare.** Cu un titlu constant,
 *      anunțul e „ACHU Business Hub" de fiecare dată — adică *nimic*: cel care nu vede ecranul nu
 *      află că s-a schimbat ceva. Ăsta e motivul de accesibilitate, nu confortul de la punctul 1.
 *   3. **Istoricul și favoritele** sunt de nefolosit: cincizeci de rânduri cu același nume.
 *
 * ─── ⚠️ DE UNDE VINE CUVÂNTUL, ȘI DE CE NU DINTR-O LISTĂ NOUĂ ───────────────────────────────
 * Din **meniu** (`lib/adminNav.ts`), nu din a doua listă scrisă de mână. ⛔ O a doua listă s-ar fi
 * despărțit de meniu la prima redenumire — meniul ar fi zis „Action Centre" iar tab-ul „Actions", și
 * nimeni n-ar mai fi știut care e numele adevărat al ecranului. ✅ Așa, redenumirea unui ecran se
 * face **o dată** și se vede în ambele locuri. (Și e chiar rândul „Consistent terminology" din §48.)
 *
 * ⛔ **Nicio interogare, niciun `document` aici** — fișierul e pur, ca să poată fi testat pe cazuri.
 * Scrierea o face `components/shared/DocumentTitle.tsx`.
 */
import { navGroups, offMenuScreens } from './adminNav';

/** ⚠️ Sufixul rămâne, la sfârșit: tab-ul îngust arată începutul, deci numele ecranului trebuie primul. */
export const TITLE_SUFFIX = 'ACHU';

/**
 * Ecranele care NU sunt în meniul de Admin. ⚠️ Portalurile clientului și curățătorului sunt câte
 * **o** rută fiecare (aplicații proprii înăuntru), deci aici e tot ce se poate spune despre ele din
 * adresă — și e mai mult decât un titlu constant.
 */
const OUTSIDE_ADMIN: Record<string, string> = {
  '/customer': 'My Cleaning',
  '/cleaner': 'My Work',
  '/accept-invite': 'Accept Invitation',
  /**
   * ⚠️ **Pagina publică nu trece prin router** (`App.tsx` întoarce `PublicQuoteRequestPage`
   * ÎNAINTEA lui `<BrowserRouter>`, ca formularul să funcționeze și pe `quote.achu.uk`). Deci
   * titlul de aici e citit direct de componenta ei, nu de `DocumentTitle`. ⛔ Iar un `useEffect` în
   * `App.tsx` **nu** e o variantă: ar fi un hook sub o ieșire condiționată, exact ce ACHU-400 spune
   * că nu se face („Rendered fewer hooks than expected", cădere fără stivă folositoare).
   */
  '/request-quote': 'Get a Quote',
};

/**
 * 🔴 **Ecranele de Admin care NU au rând de meniu** — lista lor stă acum lângă meniu, în
 * `lib/adminNav.ts`, fiindcă de acolo o citește și **urma de navigare** (`lib/breadcrumbs.ts`): are
 * nevoie și de părintele fiecăruia, nu doar de nume. ⚠️ Aici se ia doar numele.
 *
 * ⛔ **Mutată, nu duplicată** (Sesiunea 149, 22/08/2026): scrisă în două locuri, s-ar fi despărțit
 * la prima redenumire — tab-ul browserului ar fi spus un nume, urma de navigare altul, exact
 * defectul pe care titlul citit din meniu îl evita de la început.
 */
const EXTRA_ADMIN_TITLES: Record<string, string> = Object.fromEntries(
  Object.entries(offMenuScreens).map(([path, screen]) => [path, screen.label]),
);

/** Harta adresă → cuvântul din meniu, construită o dată din aceeași listă pe care o vede omul. */
const ADMIN_TITLES: Record<string, string> = {
  ...Object.fromEntries(navGroups.flatMap(group => group.links.map(link => [link.to, link.label]))),
  ...EXTRA_ADMIN_TITLES,
};

/**
 * 🔴 **Titlul unei adrese, sau `null` dacă nu se poate spune nimic adevărat despre ea.**
 *
 * ⚠️ `null`, nu un titlu inventat: pe o adresă necunoscută (`/admin/ceva-greșit`) ecranul arată
 * „not found", iar un tab care ar zice numele unui ecran care nu s-a deschis ar minți exact acolo
 * unde omul caută ce a greșit. ⛔ Atunci rămâne titlul de bază din `index.html`.
 */
export function titleForPath(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const exact = ADMIN_TITLES[clean] ?? OUTSIDE_ADMIN[clean];
  if (exact) return exact;

  /**
   * ⚠️ Adresele mai adânci ale portalurilor (`/customer/orice`) primesc titlul portalului: sunt
   * ecrane din aceeași aplicație, iar „My Cleaning" e adevărat pentru toate. ⛔ Pentru `/admin`
   * NU se face asta: acolo fiecare ecran are ruta lui în meniu, deci o potrivire pe prefix ar
   * ascunde chiar greșeala de adresă.
   */
  const portal = Object.keys(OUTSIDE_ADMIN).find(p => p !== '/login' && clean.startsWith(`${p}/`));
  return portal ? OUTSIDE_ADMIN[portal] : null;
}

/** Titlul întreg, cu sufixul firmei. ⚠️ `null` înseamnă „nu-l atinge". */
export function documentTitleFor(pathname: string): string | null {
  const title = titleForPath(pathname);
  return title ? `${title} · ${TITLE_SUFFIX}` : null;
}

