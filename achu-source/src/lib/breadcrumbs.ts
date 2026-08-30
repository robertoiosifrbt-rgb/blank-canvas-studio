/**
 * §48 „Breadcrumbs / Back navigation" (Sesiunea 149, 22/08/2026) — **URMA DE NAVIGARE.**
 *
 * ─── 🔴 CE LIPSEA, ȘI PE CINE COSTA ─────────────────────────────────────────────────────────
 * Aplicația spune „unde ești" într-un singur fel: **rândul aprins din meniu**. ⛔ Iar ăla nu
 * funcționează în două cazuri, amândouă măsurate, nu presupuse:
 *
 *   1. 🔴 **Cele două ecrane fără rând de meniu** (`lib/adminNav.ts` — `offMenuScreens`):
 *      registrul breșelor și foaia de drum. Se ajunge la ele dintr-un link, nu se aprinde nimic în
 *      meniu, deci nu exista **nici reper, nici drum înapoi** în afară de butonul browserului.
 *   2. ⚠️ **Pe telefon meniul nu se vede deloc** — e sub butonul „Menu". Deci pe ecranul îngust,
 *      unde oricum se lucrează cel mai des în mers, nu exista niciun indiciu despre grupul din care
 *      face parte ecranul deschis.
 *
 * ─── ⛔ DE CE NU „ÎNAPOI" DIN ISTORIC ────────────────────────────────────────────────────────
 * 🔴 Un buton pe `history.back()` **nu duce unde crede omul**: duce de unde a venit — care poate fi
 * un email, un link din notificare, sau chiar nimic (tab nou, adresă lipită). Un link către
 * **părinte** duce mereu în același loc, iar locul acela e adevărat oricum ai ajuns aici. ⚠️ De asta
 * `parent` e scris lângă meniu, pe fiecare ecran fără rând, ca DATE — nu se ghicește din adresă.
 *
 * ─── ⛔ CE NU FACE FIȘIERUL ────────────────────────────────────────────────────────────────────
 * Nicio interogare, niciun `document`, niciun hook: e pur, ca să poată fi ținut pe cazuri de
 * `breadcrumbs.test.ts`. Desenul e în `components/admin/Breadcrumbs.tsx`.
 */
import { navGroups, offMenuScreens } from './adminNav';

/**
 * Un pas din urmă. ⚠️ `to` **lipsește** în două situații, și amândouă sunt intenționate:
 * pe **grup** (un grup din meniu e o grămadă de ecrane, nu un ecran — n-are adresă) și pe
 * **ultimul pas**, fiindcă acolo ești deja. 🔴 Un link către pagina pe care o citești e zgomot pentru
 * oricine navighează din tastatură: încă un „Tab" care nu duce nicăieri.
 */
export type Crumb = { label: string; to?: string };

/** ⚠️ Un „/" la final e aceeași pagină — la fel ca în `pageTitle.ts`, din același motiv. */
function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/**
 * Urma până la un ecran, sau `null` dacă adresa nu e un ecran cunoscut.
 *
 * ⚠️ Recursiv pe `parent`, ca un ecran deschis din alt ecran fără rând de meniu să-și ia toată urma
 * fără să fie scris nimic în plus. ⛔ Azi adâncimea e 1; a doua nu costă nimic.
 */
function crumbsForScreen(path: string): Crumb[] | null {
  for (const group of navGroups) {
    const link = group.links.find(l => l.to === path);
    if (link) return [{ label: group.title }, { label: link.label, to: path }];
  }

  const off = offMenuScreens[path];
  if (!off) return null;
  const parent = crumbsForScreen(off.parent);
  /**
   * 🔴 Dacă părintele nu se găsește, urma întreagă cade — nu se întoarce o urmă ciungă. ⚠️ O urmă
   * care ar arăta doar „Breach Register" ar spune că ecranul n-are de unde să vină, ceea ce e fals;
   * iar un `parent` scris greșit trebuie să se vadă în test, nu să se ascundă la jumătate.
   */
  if (!parent) return null;
  return [...parent, { label: off.label, to: path }];
}

/**
 * 🔴 **Urma unei adrese, sau lista goală dacă nu se poate spune nimic adevărat despre ea.**
 *
 * ⚠️ Gol, nu o urmă inventată — exact hotărârea din `pageTitle.ts`, din același motiv: pe
 * `/admin/ceva-greșit` ecranul arată „not found", iar o urmă care ar numi un grup ar sugera că ai
 * deschis ceva. ⛔ Și portalurile (client, curățător) întorc gol: fiecare e **o** rută cu aplicația
 * lui înăuntru, deci n-are ierarhie de rute pe care să se citească ceva.
 */
export function trailFor(pathname: string): Crumb[] {
  const crumbs = crumbsForScreen(normalise(pathname));
  if (!crumbs) return [];
  /** ⚠️ Ultimul pas pierde linkul: acolo ești deja (vezi `Crumb`). */
  return crumbs.map((crumb, i) => (i === crumbs.length - 1 ? { label: crumb.label } : crumb));
}

