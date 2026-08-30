/**
 * §8, felia a doua (Sesiunea 146) — CATALOGUL, PENTRU CELE TREI FORMULARE.
 *
 * 🔴 **Înlocuiește `src/lib/quoteFormFields.ts`, care era a patra copie a aceleiași liste.**
 * Serviciile și pozițiile lor erau scrise de mână acolo, din nou în `PRICE_FIELDS` pe backend, și
 * existau ca 39 de coloane pe `quote_requests`. ⛔ Deci owner-ul nu putea adăuga un subserviciu
 * fără trei fișiere și o migrație — exact ce a cerut să se poată.
 *
 * ⚠️ Aceleași trei ecrane îl folosesc (calculatorul de preț, formularul din portal, formularul
 * public), ca să nu se depărteze — motivul pentru care fișierul vechi era comun.
 */
import { useEffect, useState } from 'react';
import { apiGet } from './apiClient';
import { SERVICE_QUANTITY_FIELDS, SERVICES as FALLBACK_SERVICES } from './fallbackServices';

/**
 * ⚠️ `key`, nu `fieldKey`: exact forma pe care o citeau cele trei ecrane din fișierul șters, ca
 * schimbarea să fie „de unde vine lista", nu o rescriere a trei formulare.
 */
export type CatalogueItem = { key: string; label: string };
export type CatalogueService = {
  name: string;
  category: string | null;
  customerDescription: string | null;
  minimumNoticeHours: number | null;
  items: { fieldKey: string; label: string }[];
};

/**
 * ⚠️ **Publică**: ruta nu cere autentificare, fiindcă formularul public de ofertă o citește fără
 * cont. ⛔ Întoarce doar ce vede un client — niciodată descrierea internă.
 */
export function getActiveCatalogue() {
  return apiGet<{ records: CatalogueService[] }>('/services/active');
}

/**
 * Serviciile active și pozițiile lor.
 *
 * 🔴 **`loading` NU se ignoră.** Lista venea până acum dintr-o constantă, deci exista din prima
 * randare; acum vine dintr-un drum la server. ⚠️ Un ecran care desenează înainte de răspuns arată
 * „niciun serviciu" — adică exact ca un catalog gol, care e o defecțiune, nu o stare normală.
 */
export function useServiceCatalogue() {
  const [services, setServices] = useState<CatalogueService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getActiveCatalogue()
      .then(r => { if (live) setServices(r.records); })
      /**
       * 🔴 **EROAREA REALĂ SE PĂSTREAZĂ — reparație 29/08/2026 (ACHU-810).** ⛔ Până azi `catch`-ul
       * era gol (`() => ...`) și punea în loc o propoziție generică, deci motivul adevărat — un 404,
       * un 401, o rețea căzută — **nu ajungea nicăieri**: nici pe ecran, nici în consolă.
       *
       * ⚠️ **Ce a costat:** formularul public a stat gol, iar nici owner-ul de pe telefon, nici
       * sesiunile care au căutat cauza n-au avut ce măsura — s-au dat trei ipoteze greșite pe rând,
       * fiindcă singurul lucru care ar fi răspuns fusese aruncat chiar aici.
       *
       * ⛔ **`detail` NU e pentru client** — el vede propoziția de sus. E rândul mic de dedesubt, pe
       * care îl citește cine repară, sau îl fotografiază cine sună.
       */
      .catch((e: unknown) => {
        if (!live) return;
        setError('The list of services could not be loaded. Please refresh.');
        setErrorDetail(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  /**
   * 🔴 **PLASA — reparație 29/08/2026 (ACHU-810), și e cea mai importantă linie din fișier.**
   *
   * ⛔ Din 21/08/2026 (`ef7537a5`) formularul public atârna în întregime de cererea de mai sus: dacă
   * pica, secțiunea „Select Services" rămânea **goală**, iar vizitatorul nu avea ce bifa. ⚠️ Măsurat:
   * **opt zile** în care singura ușă prin care intra un client nou era moartă, fără ca cineva să
   * raporteze — un om care nu poate completa un formular pleacă, nu sună.
   *
   * ✅ Acum, dacă lista nu vine, se folosesc cele 11 servicii scrise în cod. Formularul se poate
   * trimite, cererea ajunge la birou, iar `usingFallback` spune pe ecran că lista poate fi incompletă.
   *
   * ⛔ **Numai pe eșec sau pe listă goală, niciodată în paralel cu catalogul** — altfel lista veche
   * din cod ar acoperi un serviciu adăugat sau stins din ecranul de Admin.
   *
   * ⚠️ **Și catalogul GOL intră aici, nu doar eroarea.** Un catalog gol e o defecțiune (aceeași linie
   * ca `assertKnownServices` pe server), nu un răspuns valid — iar simptomul pe ecran e identic.
   */
  const usingFallback = !loading && services.length === 0;

  /** Numele, pentru bifele de serviciu. */
  const serviceNames = usingFallback ? FALLBACK_SERVICES : services.map(s => s.name);
  /**
   * Poziții pe serviciu, în forma pe care o citeau ecranele din fișierul șters — ca schimbarea să
   * fie „de unde vine lista", nu o rescriere a trei formulare.
   */
  const fieldsByService: Record<string, CatalogueItem[]> = {};
  if (usingFallback) {
    for (const name of FALLBACK_SERVICES) fieldsByService[name] = SERVICE_QUANTITY_FIELDS[name] ?? [];
  } else {
    for (const s of services) fieldsByService[s.name] = s.items.map(i => ({ key: i.fieldKey, label: i.label }));
  }

  return { services, serviceNames, fieldsByService, loading, error, errorDetail, usingFallback };
}

/**
 * Cantitățile tastate, ca `{ cheie: număr }` — doar pentru serviciile bifate și doar unde s-a scris
 * ceva.
 *
 * ⚠️ **Aici, nu în ecran**, din două motive: aceeași buclă era scrisă de două ori în
 * `PriceCalculatorPage` (o dată la calcul, o dată la salvare, a doua ca un singur rând ilizibil), iar
 * fișierul e la clichetul lui de mărime și nu are voie să crească (`AGENT_RULES` §7.3, §9).
 */
export function typedQuantities(
  services: string[],
  fieldsByService: Record<string, CatalogueItem[]>,
  typed: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const service of services) {
    for (const field of fieldsByService[service] ?? []) {
      const n = Number.parseInt(typed[field.key] ?? '', 10);
      if (Number.isFinite(n) && n >= 0) out[field.key] = n;
    }
  }
  return out;
}

