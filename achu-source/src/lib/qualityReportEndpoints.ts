/**
 * §31 (Sesiunea 145, felia a doua) — RAPORTUL DE CALITATE.
 *
 * ⛔ **Fișier propriu**, ca `qualityCheckEndpoints`: `endpoints.ts` e pe clichetul de mărime.
 *
 * 🔴 **Nicio cifră nu se calculează pe ecran.** Procentele, mediile, diferența față de nota
 * clientului și eticheta „prea puține ca să însemne ceva" vin toate de pe server — inclusiv
 * **propoziția** despre acoperire, fiindcă aceea e cea care ține raportul cinstit și nu are ce căuta
 * scrisă a doua oară într-un ecran.
 */
import { apiGet } from './apiClient';

export type QualityGroupRow = {
  /** Luna `YYYY-MM`, numele serviciului, sau numele clientului. */
  label: string;
  /** Câte au un verdict. ⚠️ Cele care așteaptă NU sunt aici — nu sunt un rezultat. */
  checked: number;
  passed: number;
  failed: number;
  waiting: number;
  /** `null` = nimeni nu s-a uitat. ⛔ Nu `0`, care s-ar citi „nimic nu a trecut". */
  passRate: number | null;
  officeAverage: number | null;
  customerAverage: number | null;
  /**
   * 🔴 Nota clientului minus nota biroului. **Pozitiv = biroul e mai sever**; negativ = clientul a
   * fost mai nemulțumit decât ne-am dat seama, și aceea e jumătatea de citit cu grijă.
   */
  strictnessGap: number | null;
  /** ⚠️ Vine de pe server: cifra se arată, dar nu ca pe un fapt. */
  tooFewToMean: boolean;
};

export type QualityReportResponse = {
  from: string;
  to: string;
  coverage: {
    completedVisits: number;
    withCheck: number;
    coverage: number | null;
    /** 🔴 Propoziția de deasupra raportului. Se afișează AȘA CUM E. */
    sentence: string;
  };
  byMonth: QualityGroupRow[];
  byService: QualityGroupRow[];
  byCustomer: QualityGroupRow[];
  minSample: number;
  /** ⛔ Ce nu e în raport și de ce — „pe curățător" lipsește deliberat. */
  notIncluded: string;
};

export function getQualityReport(params: { from?: string; to?: string } = {}) {
  return apiGet<QualityReportResponse>('/quality-report', params);
}

