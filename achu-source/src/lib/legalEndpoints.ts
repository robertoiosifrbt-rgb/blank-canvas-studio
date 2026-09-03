/**
 * CE CITEȘTE ȘI CE SEMNEAZĂ CLIENTUL — consimțămintele, nota de confidențialitate și Service
 * Agreement-ul.
 *
 * ⚠️ **Scos din `endpoints.ts` la felia ACHU-683/725** (`AGENT_RULES` §7.4): catalogul e la
 * plafon, iar felia atingea chiar aceste patru funcții. A optsprezecea oară când o felie iese
 * din fișier ca să încapă — și, ca de fiecare dată, gruparea e ce ar fi trebuit să fie oricum:
 * astea sunt singurele apeluri din aplicație cu greutate **juridică**.
 */
import { apiGet, apiPost } from './apiClient';
import type { PortalPrivacyNotice } from '@/components/customer/portalTypes';

/**
 * ACHU-427 — the seven optional permissions, and the customer's own answers.
 *
 * ⚠️ The WORDING comes from the server and is never sent back.
 *
 * 🔴 ACHU-725 — the VERSION now travels back, and that does NOT contradict the line above.
 * It is used **only to refuse**, never to write: the recorded version is always the server's
 * own. A client that lies about what it displayed can therefore obtain a rejection, never a
 * false record — while a customer left on a stale tab is stopped, which is the whole point.
 * Motivele întregi: `backend/src/lib/portalVersionGuard.ts`.
 */
export function getCustomerConsents() {
  return apiGet<{
    topics: {
      key: string; label: string; question: string; detail: string; version: string;
      granted: boolean | null; answeredAt: string | null; wordingChanged: boolean;
    }[];
  }>('/customer-portal/consents', {});
}

export function saveCustomerConsents(answers: { topic: string; granted: boolean; wordingVersion: string }[]) {
  return apiPost<{ success: true; recorded: number; auditWarning?: string }>('/customer-portal/consents', { answers });
}

/**
 * ACHU-545 (Sesiunea 120) — the privacy notice as a SCREEN, not a PDF.
 *
 * ⛔ The retention part is built on the server from the erasure policy that actually
 * runs (`backend/src/lib/privacyNoticeContent.ts`). Nothing here composes that text,
 * deliberately: a browser-side copy of "how long we keep your data" would be a second
 * statement of a fact whose source is backend code, and the copy is always the one that
 * goes stale. Same reason the consent wording is served rather than shipped.
 */
export function getPrivacyNotice() {
  return apiGet<PortalPrivacyNotice>('/customer-portal/privacy', {});
}

/**
 * ACHU-475 (Sesiunea 100) — View documents / Sign agreements.
 *
 * The server hands over the INGREDIENTS (the customer's own fields, the
 * business's own settings, today's date), not a rendered file — the PDF is
 * built here in the browser with `serviceAgreement()`/`privacyNotice()`/
 * `consentForm()`, exactly as Admin's preview already does. `settings` is
 * typed loosely on purpose: it is `DocSettings`-shaped, but importing that
 * type here would couple this file to `customerDocuments.ts` for no benefit
 * over the caller doing the cast.
 */
export function getCustomerDocuments() {
  return apiGet<{
    customer: { customerName: string | null; address: string | null; postcode: string | null; email: string | null; phone: string | null };
    settings: Record<string, unknown>;
    today: string;
    agreement: {
      currentTemplateVersion: string;
      signed: boolean;
      signedName: string | null;
      signedAt: string | null;
      templateVersion: string | null;
      templateChanged: boolean;
      signingDisabled: boolean;
      /** ACHU-683 — se trimite înapoi la semnare, ca dovadă a ce s-a citit. */
      termsSnapshot: string;
    };
  }>('/customer-portal/documents', {});
}

export function signCustomerDocument(input: {
  signedName: string;
  /** 🔴 ACHU-683 — amprenta termenilor AFIȘAȚI. Serverul refuză dacă între timp s-au schimbat. */
  termsSnapshot: string;
  /** ACHU-486 — Consumer Contracts Regulations 2013, Regulation 36. */
  earlyServiceRequested: boolean;
  earlyServiceAcknowledged: boolean;
}) {
  return apiPost<{
    success: true;
    agreement: { signedName: string; signedAt: string; templateVersion: string; currentTemplateVersion: string };
    auditWarning?: string;
  }>('/customer-portal/documents/sign', input);
}

