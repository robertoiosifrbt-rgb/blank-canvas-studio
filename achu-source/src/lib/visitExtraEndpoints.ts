/**
 * §16 „Customer-requested additions" (Sesiunea 148) — **un punct cerut pe O vizită.**
 *
 * ⛔ **Fișier propriu, nu două funcții în `endpoints.ts`:** catalogul era la 236 de rânduri de cod,
 * exact clichetul lui, iar regula spune ce se face atunci — iese cod, cifra nu urcă
 * (`AGENT_RULES` §7). ⚠️ Nereexportat din catalog, deliberat: apelantul e un singur ecran
 * (`AdminChecklistSection`), iar un import direct spune de unde vine capabilitatea.
 *
 * 🔴 Ce NU e aici: bifarea. Aceea e `updateJobChecklistItem`, pe drumul checklistului generat —
 * punctul adăugat se bifează exact ca oricare altul, și asta e ideea.
 */
import { apiPost, apiDelete } from './apiClient';

/**
 * ⚠️ **`required` absent înseamnă „muncă de făcut"** — serverul decide implicitul, nu ecranul (ruta
 * pune `true`). ⛔ Un implicit scris în două locuri s-ar despărți la prima schimbare, iar aici
 * diferența e dacă vizita se poate încheia sau nu.
 *
 * ⚠️ `customerRequestId` e opțional fiindcă biroul poate adăuga un punct și din proprie inițiativă
 * (o notă lăsată de curățătorul de săptămâna trecută); a-l face obligatoriu ar fi împins pe cineva
 * să inventeze o cerere.
 */
export function addVisitChecklistPoint(body: {
  jobId: string;
  label: string;
  required?: boolean;
  photoRequired?: boolean;
  customerRequestId?: string;
}) {
  return apiPost<{ success: true; id: string; auditWarning?: string | null }>('/job-checklist-extra', body);
}

/**
 * 🔴 **Scoate din uz, nu șterge.** ⛔ Iar serverul refuză un punct deja bifat sau marcat „nu se
 * aplică": ce s-a raportat ca făcut trebuie să rămână pe listă. ⚠️ Ecranul nu repetă regula, o
 * arată — butonul nu apare pe rândurile la care s-a răspuns.
 */
export function removeVisitChecklistPoint(itemId: string) {
  return apiDelete<{ success: true; auditWarning?: string | null }>(`/job-checklist-extra/${itemId}`);
}

