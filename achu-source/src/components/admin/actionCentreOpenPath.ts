/**
 * ACTION CENTRE — UNDE DUCE UN RÂND CÂND CINEVA APASĂ PE EL.
 *
 * ─── 🔴 ACHU-777 (Sesiunea 154): ȘASE SECȚIUNI DIN CINCISPREZECE NU DESCHIDEAU NIMIC ────
 *
 * ⛔ `openRecord` din `ActionCentrePage.tsx` cunoștea șapte feluri de rând. Cozile adăugate după
 * el — notele mici neurmărite (§36), hârtiile curățătorilor (§33), și cele patru din Sesiunea 150
 * (dosare deschise, re-curățenii, verificări de calitate, oferte) — cădeau prin toate ramurile și
 * **nu se întâmpla nimic la click**.
 *
 * ⚠️ **De ce e un defect și nu o lipsă:** rândul are `cursor-pointer`, `tabIndex={0}` și Enter pe
 * tastatură, deci ecranul PROMITE că se deschide ceva. Un click mort se citește ca aplicație
 * stricată; iar pe tastatură rândul primește focus și Enter nu face nimic — exact felul de gaură
 * care nu se vede la o privire pe ecran.
 *
 * 🔴 **De ce a crescut gaura cu fiecare felie:** harta trăia în mijlocul unei funcții de 10 rânduri
 * dintr-o pagină de aproape 1000, iar nimic nu lega „am adăugat o secțiune" de „am adăugat un
 * drum". ✅ Acum e un fișier cu un singur rost, iar felul nou de rând se adaugă **aici**.
 *
 * ─── ⚠️ PAGINA, NU RÂNDUL ───────────────────────────────────────────────────
 *
 * Niciunul din ecranele celor șase nu citește `?id=` (măsurat, nu presupus). ⛔ Deci nu se
 * inventează un parametru pe care pagina nu-l citește — la fel ca la `timeEntry` și
 * `customerRequest`, care duceau de mult la pagină. Ce se rezolvă e „clickul nu duce nicăieri",
 * nu „clickul deschide exact rândul".
 *
 * ⛔ **`priceQuote` NU merge la `/admin/price-quotes`** — ecranul acela nu există. Aia e chiar
 * ACHU-438: un link scris din memoria mount-ului de API (`/price-quotes`), care a ajuns în
 * clopoțelul biroului și l-a dus pe owner la „This screen does not exist here". Ofertele se
 * citesc și se scriu pe ecranul calculatorului.
 */

/**
 * Ecranul pe care se rezolvă fiecare fel de rând. ⚠️ Cheile sunt `entityType`-urile scrise de
 * server (`backend/src/lib/actionCentre*.ts`), nu nume alese aici.
 */
const RECORD_PAGE: Record<string, string> = {
  incident: '/admin/incidents',
  reClean: '/admin/re-cleans',
  jobQualityCheck: '/admin/quality-checks',
  priceQuote: '/admin/price-calculator',
  cleanerDocument: '/admin/cleaners',
  /**
   * 🆕 §21 „Missing cleaner paperwork" (Sesiunea 158). ⚠️ **Fără `?id=`**, în harta de sus și nu în
   * cea de jos: `CleanersPage` nu citește parametrul, iar un link cu `?id=` care nu deschide nimic
   * e mai rău decât unul care duce la listă — omul crede că a apăsat greșit. ⛔ Lista scurtă de jos
   * e deliberat doar pentru ecranele despre care s-a **măsurat** că îl citesc.
   */
  cleaner: '/admin/cleaners',
  jobRating: '/admin/feedback',
  /**
   * 🔴 **AL ȘAPTELEA, găsit de testul de mai jos, nu de un ochi.** Contractele fără vizite
   * programate (§18) erau tot un click mort — trecuseră pe lângă lista scrisă de mână chiar în
   * felia care repara celelalte șase. ⚠️ De asta paza citește `entityType`-urile din sursa
   * serverului: o listă scrisă alături ratează exact la fel.
   */
  recurringSeries: '/admin/recurring',
  // ACHU-268 — Timesheets e locul în care o oră se aprobă, se întreabă sau se închide.
  timeEntry: '/admin/timesheets',
  // ACHU-342 — Client Issues e locul în care se răspunde unei cereri a clientului.
  customerRequest: '/admin/customer-requests',
  /**
   * 🆕 §34 (Sesiunea 160). ⚠️ **Fără `?id=`**, în harta de sus: ecranul de stoc e o listă scurtă în
   * care rândul se găsește din ochi, iar un `?id=` pe care pagina nu-l citește e mai rău decât un
   * link către listă — omul crede că a apăsat greșit.
   */
  inventoryItem: '/admin/inventory',
  // §35 (Sesiunea 160) — fără `?id=`: lista e scurtă, rândul se găsește din ochi.
  vehicle: '/admin/vehicles',
};

/**
 * Ecranele care deschid **chiar înregistrarea**, pe `?id=`. ⚠️ Lista e scurtă deliberat: aici
 * intră doar ecranele despre care s-a măsurat că citesc parametrul.
 */
const RECORD_PAGE_WITH_ID: Record<string, string> = {
  job: '/admin/jobs',
  /**
   * 🆕 §4 „Next follow-up date" (Sesiunea 160). ⚠️ Aici, nu în harta de sus: `CustomersPage`
   * **citește** `?id=` (`sp.get('id')`) și deschide fișa — măsurat, nu presupus. 🔴 Rândul spune
   * „sună-l azi", deci a-l duce la o listă de sute de clienți ar fi mutat munca înapoi pe om.
   */
  customer: '/admin/customers',
  payment: '/admin/payments',
  expense: '/admin/expenses',
  userAccount: '/admin/users',
  quoteRequest: '/admin/quote-requests',
};

/**
 * Drumul pe care se deschide un rând, sau `null` dacă felul lui nu are încă un ecran.
 *
 * ⛔ `null` **nu e o scuză**: e ce se întâmpla la toate șase înainte. Un fel nou de rând se adaugă
 * în una din cele două hărți de mai sus, în aceeași felie în care apare secțiunea.
 */
export function actionCentreRecordPath(entityType: string, entityId: string, returnTo: string): string | null {
  const withId = RECORD_PAGE_WITH_ID[entityType];
  if (withId) return `${withId}?id=${entityId}&returnTo=${returnTo}`;
  const page = RECORD_PAGE[entityType];
  return page ? `${page}?returnTo=${returnTo}` : null;
}

