/**
 * 🔴 CE AȘTEAPTĂ, ȘI CE ANUME TREBUIE SĂ SE ÎNTÂMPLE — ecranul „Waiting On".
 *
 * Roberto, 15/08/2026: *„vreau sa iei din fata mea unele probleme"*. Fila „Parcate" din registru
 * le scoate din lista deschisă; ecranul le arată **fără să deschidă nimeni registrul**.
 *
 * ⛔ **O problemă parcată nu e o problemă rezolvată.** Fiecare rând are un **DECLANȘATOR** — ce
 * anume trebuie să se întâmple ca să redevină muncă — fiindcă nimeni nu e anunțat automat.
 *
 * ⚠️ **Sursa de adevăr rămâne registrul** (fila „Parcate"). Rândurile de mai jos sunt oglinda ei
 * pentru un ecran, iar `handoff-check.mjs` **pică** dacă ID-urile de aici nu sunt exact cele din
 * registru — altfel ecranul ar fi o a doua listă care se învechește în tăcere.
 */

export type ParkedIssue = {
  id: string;
  /** Ce e, în cuvintele cuiva care nu scrie cod. */
  what: string;
  /** ⛔ CE trebuie să se întâmple. Nu o dată vagă — un eveniment sau un termen. */
  trigger: string;
  /** Ce se face în ziua în care declanșatorul s-a produs. */
  then: string;
  /** 🔴 Ce se strică dacă nimeni nu observă declanșatorul. */
  ifMissed: string;
};

export const PARKED_ISSUES: ParkedIssue[] = [
  {
    id: 'ACHU-271',
    what: 'The Railway credit that keeps the app and the server running.',
    trigger: 'A DATE, not an event — open the Railway panel before 27 August 2026.',
    then: 'Read the remaining balance. If it has fallen again, top it up or set a new date here.',
    ifMissed: 'Both services stop. Nobody is warned — not you, not a customer trying to book.',
  },
  {
    id: 'ACHU-320',
    what: 'Five GDPR duties that came with holding National Insurance numbers and home addresses for payroll.',
    trigger: 'The first real wage paid to an employee — or the day the firm has an accountant or a GDPR adviser.',
    then: 'Write the legal basis and the retention period, tell employees what is held, decide who may see unmasked details, and build erasure for employees (customers already have it).',
    ifMissed: 'Two of the five already apply today, because the app holds customer data as well: a firm with no written legal basis and no retention period is the one that cannot answer the first question the ICO asks.',
  },
  {
    id: 'ACHU-497',
    what: 'A tax refund can be due in a period where nobody is paid — and the app does not record that the employee asked for it.',
    trigger: 'The first real wage paid to an employee, or payroll starting again.',
    then: 'Record who asked for the refund and when, and hold approval until it is there. HMRC pays it in a nil-pay period only on the employee’s request (CWG2 1.20).',
    ifMissed: 'A refund is paid out of the firm’s own money in a period where nothing else is paid, with nothing on file to show why.',
  },
  {
    id: 'ACHU-242',
    what: 'Employment Allowance — a reduction in what the firm pays as an employer.',
    trigger: 'The first real wage paid to an employee.',
    then: 'Claim it for that tax year. The code is ready and the claim is held back until somebody says yes. No accountant: gov.uk and the HMRC Employer Helpline.',
    ifMissed: 'The firm pays more employer National Insurance than it has to, for a whole year.',
  },
  {
    id: 'ACHU-303',
    what: 'Sick pay eligibility is not checked against Employment and Support Allowance.',
    trigger: 'The first sick pay paid to a real person.',
    then: 'Ask the person whether they received ESA in the last 85 days. HMRC refuses SSP if they did.',
    ifMissed: 'Sick pay is paid where HMRC says it should not be, and it is the firm that has to get it back.',
  },
  {
    id: 'ACHU-304',
    what: 'A day worked in part is counted as a whole day of sickness.',
    trigger: 'The first employee who is off for part of a day.',
    then: 'Correct the spell by hand. The limitation is named in the code and held by a test.',
    ifMissed: 'One day of sick pay too many, on one payslip. Small, and known.',
  },
  {
    id: 'ACHU-392',
    what: 'The pension duty dates are worked out on the server, and no screen shows them.',
    trigger: 'Payroll starts again — it was stopped by Archana on 4 August 2026.',
    then: 'Build the screen. Everything behind it already exists.',
    ifMissed: 'Nothing breaks. A date nobody can see is a date nobody acts on.',
  },
  {
    id: 'ACHU-376',
    what: 'The database project is on the free plan, under a live payroll.',
    trigger: 'Payroll runs on real people, or Supabase warns about limits.',
    then: 'Move to a paid plan. Nothing is broken today; the free plan simply promises nothing.',
    ifMissed: 'An outage nobody can escalate, on the day wages have to be paid.',
  },
  {
    id: 'ACHU-393',
    what: 'Two moderate security advisories in a library the app uses for its pages.',
    trigger: 'A fix appears in the 6.x line, or the app moves to version 7.',
    then: 'Upgrade. Neither advisory can be exploited here — this app renders in the browser, not on a server.',
    ifMissed: 'Nothing today. It matters only if the app ever renders pages on the server.',
  },
];

