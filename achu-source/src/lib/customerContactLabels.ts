/**
 * §4 „Multiple contacts per customer" (Sesiunea 160) — CUVINTELE, ÎNTR-UN SINGUR LOC.
 *
 * 🔴 **Oglindesc `backend/src/lib/customerContactPolicy.ts`.** ⛔ Nu se rescriu pe ecran: aceleași
 * cuvinte apar în listă, în formular și oriunde ajunge un contact mai târziu, iar trei texte scrise
 * separat ajung să spună trei lucruri despre același rol.
 *
 * ⚠️ **Valorile sunt ale serverului**, nu ale ecranului: un rol nou apare acolo, iar aici primește
 * doar eticheta. Un rol necunoscut se afișează ca atare, nu se ascunde — vezi `contactRoleLabel`.
 */
export const CONTACT_ROLE_LABELS: Record<string, string> = {
  Tenant: 'Tenant',
  LettingAgent: 'Letting agent',
  PropertyManager: 'Property manager',
  CompanyContact: 'Company contact',
  Other: 'Other',
};

/**
 * ⚠️ Cele trei semne, cu cuvintele care spun CE FACI cu omul, nu cine e el față de casă.
 */
export const CONTACT_FLAG_LABELS = {
  isPrimary: 'Main contact',
  isBilling: 'Billing contact',
  isEmergency: 'Emergency contact',
} as const;

/**
 * ⛔ **Un rol necunoscut se arată, nu se ascunde.** Dacă serverul câștigă un rol nou și ecranul nu
 * are încă eticheta, un rând gol ar arăta ca o scăpare a biroului; valoarea brută e urâtă, dar
 * adevărată — și se repară într-o linie.
 */
export function contactRoleLabel(role: string): string {
  return CONTACT_ROLE_LABELS[role] ?? role;
}

