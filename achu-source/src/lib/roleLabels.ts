/**
 * NUMELE ROLURILOR, AȘA CUM LE CITEȘTE UN OM.
 *
 * ⛔ **De ce există fișierul ăsta, din 20/08/2026 (Sesiunea 144):** owner-ul a cerut ca rolul cu
 * control complet să se **numească** așa — *„schimba numele rolului in SuperAdmin sau ceva care sa
 * aiba full control la toata aplicatia"*. ⚠️ Numele erau scrise **de mână în șase locuri** (două
 * liste de alegere, două tabele, pagina de acceptare a invitației, jurnalul de erori), deci un
 * singur cuvânt schimbat ar fi lăsat cinci ecrane spunând altceva.
 *
 * ─── 🔴 ACUM SUNT DOUĂ ROLURI, NU UNUL REDENUMIT (20/08/2026, a doua parte) ──
 * Owner-ul a hotărât altceva decât o redenumire: *„adminul trebuie sa fie mai limitat… punema pe
 * mine superadmin"*. ✅ Deci `SuperAdmin` e o valoare **nouă**, adăugată lângă `Admin` — nu în locul
 * lui.
 *
 * ⚠️ **De ce e mai sigur așa decât o redenumire:** o redenumire ar fi căzut pe ordinea obligatorie
 * (`AGENT_RULES` §5) — SQL-ul rulează **înaintea** codului, deci între cele două, codul de pe
 * producție ar fi căutat `'Admin'` și nu l-ar mai fi găsit: ⛔ toate conturile de birou ar fi pierdut
 * accesul, iar există exact unul. ✅ Un rol **adăugat** nu are intervalul acela: codul cunoaște
 * amândouă valorile înainte ca vreun rând să aibă cea nouă.
 *
 * 🔴 **`Admin` NU a pierdut nicio permisiune în felia asta** — owner-ul a spus *„inca nu am decis"*
 * ce anume pierde. Singura excepție hotărâtă de el: hotărârea pe o re-curățenie. ⚠️ Deci eticheta lui
 * `Admin` se întoarce la „Admin"; a-l lăsa „Super Admin" ar fi pus **același nume pe două roluri
 * diferite**, iar ecranul care acordă accesul ar fi devenit o capcană.
 */

/**
 * ⚠️ **„Super Admin", nu „SuperAdmin":** eticheta e un nume citit de oameni pe un ecran, iar cuvintele
 * lipite sunt o convenție de cod. 🔴 **Valoarea stocată e `SuperAdmin`, fără spațiu** — cele două nu
 * se amestecă niciodată: ce e la stânga e ce scrie în bază, ce e la dreapta e ce vede omul.
 */
export const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super Admin',
  Admin: 'Admin',
  ReadOnly: 'Read only',
  FinanceOnly: 'Finance only',
  HROnly: 'HR only',
  Cleaner: 'Cleaner',
  Customer: 'Customer',
};

/**
 * ⚠️ **Un rol necunoscut se întoarce AȘA CUM E**, nu ca „—" sau ca text golit: dacă apare vreodată
 * un rol nou în bază înaintea unui ecran care îl știe, e mai bine să se vadă cuvântul brut decât să
 * dispară contul din tabel.
 */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}

/**
 * O propoziție despre ce poate rolul, pentru ecranele care **acordă** accesul.
 *
 * 🔴 Există fiindcă owner-ul a cerut un nume care spune „full control": ⛔ un nume singur nu poate
 * spune asta nimănui care nu a construit aplicația. ⚠️ Scrise la ce **pot**, nu la ce le lipsește —
 * o listă de lucruri interzise se citește ca un cont stricat (aceeași alegere ca la
 * `NARROW_ROLE_BANNERS`).
 */
export const ROLE_MEANS: Record<string, string> = {
  /**
   * ⚠️ Propoziția spune și **cum se obține**, fiindcă ecranul nu o oferă: rolul se pune doar direct în
   * baza de date. Fără rândul ăsta, cine caută opțiunea în listă crede că ecranul e stricat.
   */
  SuperAdmin: 'Full control of the whole application, including money, payroll and everybody else’s access. '
    + 'It cannot be given from this screen — it is set directly in the database, so that nobody can grant '
    + 'themselves full control from inside the app.',
  Admin: 'Runs the office: jobs, customers, properties, cleaners, invoices and payroll. '
    + 'Cannot approve a free re-clean — that commits the company to unpaid work, so it is the Super Admin’s call.',
  ReadOnly: 'Can look at every screen, and change nothing.',
  FinanceOnly: 'Payroll money only: runs, reports and the simulator.',
  HROnly: 'Employee records only: details, timesheets, holiday, sickness and family leave.',
  Cleaner: 'Their own jobs, hours and pay on the cleaner app.',
  Customer: 'Their own jobs, invoices and details in the customer portal.',
};

