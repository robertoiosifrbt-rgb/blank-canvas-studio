/**
 * 🔴 §45 „Third-party sharing record" (Sesiunea 158) — REGISTRUL DESTINATARILOR.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7): catalogul e la
 * clichetul lui de mărime, iar felia asta aduce o formă întreagă.
 *
 * ⚠️ **Cele două stări și „ce lipsește" vin de la SERVER**, nu se compun aici: ecranul de azi și un
 * export de mâine trebuie să spună la fel despre același rând.
 */
import { apiGet, apiPost } from './apiClient';

/** Ce spune serverul despre contractul scris (UK GDPR art. 28). `lib/thirdPartySharingPolicy.ts`. */
export type SharingContract = {
  state: 'in-writing' | 'in-writing-no-reference' | 'none-with-reason' | 'none-no-reason' | 'unanswered';
  label: string;
};

/** Ce spune serverul despre datele care pleacă din UK (art. 44-49). */
export type SharingTransfer = {
  state: 'uk' | 'outside-covered' | 'outside-uncovered' | 'unanswered';
  label: string;
};

export type SharingRecord = {
  id: string;
  sharingId: number;
  recipient: string;
  dataShared: string;
  purpose: string | null;
  legalBasis: string | null;
  /** 🔴 `null` = nu a răspuns nimeni încă, NU „nu există". */
  hasWrittenAgreement: boolean | null;
  agreementReference: string | null;
  noAgreementReason: string | null;
  /** 🔴 `null` = nu s-a răspuns. */
  leavesUk: boolean | null;
  transferSafeguard: string | null;
  /** `YYYY-MM-DD` sau `null`. */
  startedOn: string | null;
  endedOn: string | null;
  status: 'Active' | 'Ended';
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  contract: SharingContract;
  transfer: SharingTransfer;
  /** Ce lipsește ca rândul să fie complet, în cuvintele omului. ⛔ Raportat, nu impus. */
  missing: string[];
};

export type SharingRegister = {
  records: SharingRecord[];
  activeCount: number;
  /** 🔴 Fără contract scris ȘI fără motiv — chiar întrebarea pe care o pune ICO. */
  withoutContractCount: number;
  /** 🔴 Date care pleacă din UK fără nimic scris care să acopere transferul. */
  uncoveredTransferCount: number;
  /** ⚠️ Rânduri la care una dintre cele două întrebări nu are încă răspuns. */
  unansweredCount: number;
};

export function getDataSharing() {
  return apiGet<SharingRegister>('/data-sharing', {});
}

/**
 * Scrie un destinatar. ⚠️ Serverul cere **două** lucruri: cine primește și ce primește. ⛔ Restul se
 * raportează ca lipsă — un formular care ar cere temeiul legal pe loc ar lăsa rândul nescris.
 */
export function recordDataSharing(data: {
  recipient: string; dataShared: string; purpose?: string | null; legalBasis?: string | null;
  startedOn?: string | null;
}) {
  return apiPost<{ success: true; record: SharingRecord }>('/data-sharing', data);
}

/** Actualizează un rând. ⚠️ Nimic nu e imuabil: contractul se semnează peste o săptămână. */
export function updateDataSharing(params: { id: string } & Partial<{
  recipient: string; dataShared: string; purpose: string | null; legalBasis: string | null;
  hasWrittenAgreement: boolean | null; agreementReference: string | null;
  noAgreementReason: string | null; leavesUk: boolean | null; transferSafeguard: string | null;
  startedOn: string | null; endedOn: string | null; status: 'Active' | 'Ended';
}>) {
  const { id, ...body } = params;
  return apiPost<{ success: true; record: SharingRecord }>(`/data-sharing/${id}`, body);
}

