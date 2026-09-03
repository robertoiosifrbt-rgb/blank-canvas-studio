/**
 * 🔴 §39 „Logout audit" (Sesiunea 150) — aplicația spune că omul a apăsat Sign out.
 *
 * ⛔ **Fișier propriu, și NU re-exportat din `endpoints.ts`.** ⚠️ Motivul e măsurat, nu estetic: se
 * cheamă din `lib/useAuth.ts`, care e importat de aproape fiecare ecran, iar un import static de aici
 * ar trage `apiClient` în graful oricărei suite care mochează doar `@/lib/endpoints` — exact cele 12
 * suite rupte la §39/Sesiunea 148 (nota din `components/admin/AuditHistory.tsx`). ✅ De asta `useAuth`
 * îl încarcă **la apăsare**, cu `import()`.
 *
 * ⚠️ Intrarea NU are pereche aici, deliberat: ea se observă din backend, fără să întrebe nimeni
 * browserul (`backend/src/lib/sessionAudit.ts`).
 */
import { apiPost } from './apiClient';

export function recordLogout() {
  return apiPost<{ recorded: boolean }>('/session/logout');
}

