export const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'four-weekly', label: 'Every four weeks' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * 🔴 ACHU-401, felia 30 — `Person` NU mai e scris aici. E forma publicată de
 * `payrollProfileEndpoints.ts`, citită din ruta care o produce.
 *
 * 📜 Copia de dinainte era corectă pe scheletul ei, dar lăsa profilul deschis
 * (`Record<string, any>`) — deci tot ce e interesant despre o fișă rămânea netipizat, iar
 * jumătatea **fiscală**, care pentru un cont HR chiar lipsește, nu se putea deosebi de una
 * necompletată. ⛔ Aliasul rămâne ca **sinonim**, ca cele trei ecrane să nu-și schimbe
 * importurile.
 */
export type { PayrollPerson as Person } from './payrollProfileEndpoints';

