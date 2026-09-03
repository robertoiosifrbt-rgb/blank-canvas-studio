/**
 * Funcțiile de payroll din `endpoints.ts`, mutate VERBATIM la felia 12 (15/08/2026).
 *
 * ⛔ Nicio schimbare de comportament: aceleași nume, aceeași semnătură, aceeași cale.
 * Re-exportate din `endpoints.ts`, deci **niciun apelant nu s-a atins** — exact tiparul
 * de la `propertyEndpoints.ts` / `subscriptionEndpoints.ts` / `endpointsBackup.ts`.
 *
 * ⚠️ Mutare STRUCTURALĂ, nu construcție — payroll-ul rămâne oprit (Archana, 04/08/2026).
 * Se semnalează ca informare, nu ca cerere de aprobare.
 *
 * ⛔ **După felia 34 fișierul ăsta nu mai are nicio funcție proprie** — e doar lanțul de
 * reexporturi de mai jos, care ține promisiunea că niciun apelant nu s-a atins. De aceea nu mai
 * importă nimic din `apiClient`: fiecare modul îl importă singur.
 */

/**
 * ⚠️ ACHU-401, felia 24 — cele CINCI COZI (sporuri, rețineri, kilometraj, cheltuieli,
 * sume repetate) au ieșit în `payrollQueueEndpoints.ts`, tipizate cap-coadă. Reexportate
 * aici, deci **niciun apelant nu s-a atins**. ⛔ Ieșite, nu tipizate pe loc: formele lor
 * ar fi dus fișierul ăsta peste plafonul de 500 de rânduri (`AGENT_RULES` §7).
 */
export * from './payrollQueueEndpoints';
export * from './payrollRunEndpoints';
export * from './payrollRunAuditEndpoints';
export * from './payrollProfileEndpoints';
export * from './payrollSimulatorEndpoints';
export * from './payrollBankEndpoints';

// ─── Payroll, ETAPA 1: simulator (Sesiunea 48) ──────────────────────
// Calculates and returns. Sends nothing to HMRC, stores nothing, needs no
// migration. See backend/src/routes/payroll.ts for why that boundary matters.






/**
 * ⚠️ Sporurile (ACHU-321), reținerile (ACHU-331), kilometrajul (ACHU-360) și cheltuielile
 * (ACHU-361) stăteau aici. Au ieșit ÎNTREGI în `payrollQueueEndpoints.ts` la felia 24,
 * tipizate — reexportate mai sus, deci niciun apelant nu s-a atins.
 */

// ─── Payroll runs (ACHU-294, Sesiunea 74) ───────────────────────────
// Separate from /payroll, which is the simulator and the profiles: a run is a
// stored record of what the office decided to pay.

// ⚠️ ACHU-401 (felia 28) — RULAREA (lista, crearea, detaliul) și cele cinci butoane care o
// mișcă au ieșit în `payrollRunEndpoints.ts`, tipizate cap-coadă. 🔴 Zona a rămas `any` trei
// felii pe o presupunere GREȘITĂ: că un fișier de rută de 3254 de rânduri nu se poate scrie.
// Măsurat, are două funcții `serialise*` explicite și zero împrăștieri de rând Prisma.


// ⚠️ ACHU-401 (felia 34) — cele trei rapoarte (costul anului, absențele, programul de pensie)
// au plecat în `payrollReportEndpoints.ts`, tipizate cap-coadă. ⛔ Se compun explicit pe rută,
// deci se puteau scrie; ce le lega era că NICIUNUL nu e un document, iar tipul o spune acum.
export * from './payrollReportEndpoints';

