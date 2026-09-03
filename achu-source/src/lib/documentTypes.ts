/**
 * §33 „Document management" (Sesiunea 161) — formele hârtiilor, pe ecran.
 *
 * ⚠️ **Aceleași chei ca pe server** (`backend/src/lib/documentPolicy.ts`). ⛔ Etichetele se scriu în
 * amândouă locurile, deliberat: serverul le are pentru rândul de audit, ecranul pentru om — iar o
 * singură sursă ar fi însemnat un drum la server ca să afli cum se numește un fel de hârtie.
 */
export const DOCUMENT_SCOPES = ['Company', 'Job', 'Quote', 'Invoice'] as const;
export type DocumentScope = (typeof DOCUMENT_SCOPES)[number];

/**
 * ⚠️ Ordinea e cea de pe server, ca listele să arate la fel oriunde apar.
 * ⛔ **COSHH lipsește deliberat:** fișele de siguranță stau pe produs (`InventoryItem.coshhUrl`,
 * §34), ca adresă la producător — o copie urcată aici ar îmbătrâni în tăcere.
 */
export const DOCUMENT_KINDS = [
  { key: 'RiskAssessment', label: 'Risk assessment' },
  { key: 'MethodStatement', label: 'Method statement' },
  { key: 'Insurance', label: 'Insurance certificate' },
  { key: 'Certificate', label: 'Certificate' },
  { key: 'Contract', label: 'Contract or agreement' },
  { key: 'Registration', label: 'Registration or licence' },
  { key: 'Correspondence', label: 'Correspondence' },
  { key: 'Other', label: 'Other' },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]['key'];

export type DocumentRecord = {
  id: string;
  reference: number;
  scope: DocumentScope;
  kind: string;
  kindLabel: string;
  label: string | null;
  originalName: string | null;
  /** ⚠️ ISO sau `null`. Starea „expirat" se CALCULEAZĂ din ea, nu se stochează. */
  expiryDate: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  signedUrl: string | null;
};

export type DocumentList = { records: DocumentRecord[]; limit: number };

/** ⚠️ Extensiile acceptate de server, repetate aici doar ca `accept` pentru selectorul de fișiere. */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';

