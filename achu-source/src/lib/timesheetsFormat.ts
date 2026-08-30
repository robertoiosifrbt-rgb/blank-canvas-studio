export const KIND_LABEL: Record<string, string> = {
  Job: 'On a job',
  Travel: 'Travelling',
  Training: 'Training',
  Waiting: 'Waiting',
  Other: 'Other',
};

export type Entry = {
  id: string; workDate: string; startTime: string; finishTime: string;
  breakMinutes: number; workedHours: number; kind: string; status: string;
  /**
   * 🔴 §17 (Sesiunea 151) — CÂND a fost pauza, și DE CE s-a redeschis o oră aprobată.
   * ⚠️ Opționale, ca `warnings`: fixturile mai vechi din teste nu le au.
   */
  pauseStart?: string | null;
  pauseEnd?: string | null;
  correctionReason?: string | null;
  approvedBy: string | null; disputeReason: string | null; notes: string | null;
  job: { reference: number; service: string } | null;
  /**
   * ACHU-498, gaura 4 — ce e neobișnuit la orele astea (prea lungi, peste miezul nopții).
   * ⛔ **Avertismente, nu refuzuri:** intrarea e deja salvată. `[]` când nu e nimic de spus.
   * ⚠️ Opțional, fiindcă fixturile mai vechi din teste nu-l au — iar `?? []` la folosire.
   */
  warnings?: { code: string; message: string }[];
  /**
   * ACHU-498 — rândul a fost șters, dar a rămas la vedere (Roberto, 15/08/2026:
   * „da, sa ramana urma"). ⛔ Numai tabelul biroului primește vreodată rânduri
   * șterse; portalul curățătorului și orice calcul de bani le exclud din
   * interogare, deci acolo câmpul nu apare niciodată adevărat.
   * ⚠️ Opționale, ca `warnings`: fixturile mai vechi din teste nu le au.
   */
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
};

export type FormState = {
  id?: string;
  workDate: string;
  startTime: string;
  finishTime: string;
  breakMinutes: string;
  /** §17 — fereastra pauzei, „HH:MM". ⚠️ Amândouă sau niciuna; serverul refuză o jumătate. */
  pauseStart: string;
  pauseEnd: string;
  kind: string;
  jobId: string | null;
  notes: string;
};

