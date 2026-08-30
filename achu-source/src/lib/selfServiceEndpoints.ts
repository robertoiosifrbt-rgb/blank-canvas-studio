/**
 * ACHU-401, felia a treizeci și treia — **CE VEDE CURĂȚĂTORUL DESPRE PROPRIA PLATĂ**
 * (ACHU-314, `GET /api/me/payroll`).
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ;
 * payroll-ul rămâne oprit.
 *
 * 🔴 **Regula ecranului e că nu calculează nimic**, iar tipul ăsta e cel care o ține: soldul de
 * concediu, acumularea, totalul de boală sosesc **deja calculate**, din **aceleași** funcții de
 * politică pe care le citește biroul sub Team. ⛔ O a doua implementare în browser ar devia, iar
 * cea care deviază ar fi exact cea care îi spune unui om despre propriul lui timp liber.
 *
 * ⚠️ De aceea `balance` e **importat** din `absenceTypes.ts`, nu rescris: e obiectul produs de
 * `computeBalance`, același pentru birou și pentru curățător. A doua copie e greșeala ACHU-741.
 */
import { apiGet } from './apiClient';
import type { LeaveBalance } from './absenceTypes';

/**
 * ⚠️ **Configurarea de plată, nu un fluturaș.** Codul fiscal e lucrul pe care un angajat e cel
 * mai des rugat să-l verifice și cel mai rar i se arată.
 *
 * 🔴 `null` pe tot obiectul înseamnă că **biroul n-a completat fișa** — altă propoziție decât
 * „fără pensie", și de aceea serverul trimite separat `payrollSetupMissing`.
 */
export type MyPayrollSetup = {
  taxCode: string | null;
  niCategory: string | null;
  payFrequency: string | null;
  pensionEnrolled: boolean;
  pensionEmployeePercent: number | null;
  pensionEmployerPercent: number | null;
  studentLoanPlan: string | null;
  postgraduateLoan: boolean;
  startDate: string | null;
};

/** O cerere de concediu, așa cum și-o vede omul însuși. */
export type MyLeaveRequest = {
  kind: string;
  status: string;
  minutes: number;
  startDate: string;
  endDate: string;
};

export type MySicknessSpell = {
  reference: number;
  startDate: string;
  endDate: string | null;
  status: string;
  sspDaysPaid: number;
  sspTotalPence: number;
  /** ⚠️ `null` = **nedecis**, `0` = decis că nimic. ⛔ Ținute distincte, și pe ecranul lui. */
  companySickPayPence: number | null;
};

export type MyFamilyLeaveSpell = {
  reference: number;
  type: string;
  startDate: string;
  endDate: string | null;
  status: string;
  weeksPaid: number;
  totalPence: number;
};

/**
 * 🔴 **Ce NU poate face pagina asta — și blocul ăsta e cel care se învechește.**
 *
 * ⚠️ Cheile sunt **opționale fiecare**, fiindcă exact așa se repară o propoziție devenită
 * falsă: se **șterge** cheia, nu se pune `null`. Ecranul randează fiecare intrare pe care o
 * primește, deci un `null` ar tipări cuvântul „null" într-o listă citită de un angajat.
 *
 * ⛔ ACHU-381 a găsit **două** propoziții false randate lângă chiar funcțiile pe care le negau:
 * un buton de descărcat P60 cu o frază dedesubt spunând că P60-urile nu se produc. Un bloc al
 * cărui rost e să spună ce lipsește e chiar blocul care se învechește pe măsură ce lucrurile
 * încetează să lipsească, **și nimic nu pică atunci**. De aceea există acum un test pe server
 * care verifică faptul că nicio frază de aici nu numește o funcție care există.
 *
 * 🔴 **Un dicționar deschis, nu o listă închisă de câmpuri — și asta e o alegere, nu lene.**
 * Ecranul e condus de **chei**: o a patra limitare apare în momentul în care ruta o trimite,
 * fără schimbare de cod aici, iar un test pinuiește chiar asta. ⛔ Un tip cu cele trei chei de
 * azi ar transforma un adaos pe server într-o eroare de compilare pe frontend — exact pe dos
 * față de cum e construit blocul. `null` e admis fiindcă ecranul îl **sare**, nu îl tipărește.
 *
 * Cheile de azi: `requestLeave`, `p11d`, `address`.
 */
export type MyPayrollNotAvailable = Record<string, string | null>;

export type MyPayrollResponse = {
  /** ⚠️ Contactele lui **cum le ține biroul** — ca unul greșit să fie raportat. */
  me: { cleanerName: string; email: string | null; phone: string | null };
  payrollSetup: MyPayrollSetup | null;
  /** Spus ca propoziție, nu lăsat pe seama unui `null` interpretat de ecran. */
  payrollSetupMissing: string | null;
  holiday: {
    leaveYear: { from: string; to: string; label: string };
    /** ⛔ Produs de `computeBalance`, aceeași funcție ca la birou. Nu se recalculează aici. */
    balance: LeaveBalance;
    /** ⚠️ Spune ce **este** soldul și, mai important, ce **NU** este. */
    caveat: string;
    accrualPercent: number;
    /** Ziua în care începe anul de concediu — o **alegere** a owner-ului, nu anul fiscal. */
    leaveYearStart: string;
    statutoryWeeks: number;
    requests: MyLeaveRequest[];
  };
  sickness: MySicknessSpell[];
  familyLeave: MyFamilyLeaveSpell[];
  notAvailable: MyPayrollNotAvailable;
};

/**
 * Tot ce are voie să vadă un curățător despre **propria** plată, concediu, boală și concediu
 * de familie.
 *
 * ⛔ **Fără niciun parametru, deliberat:** serverul derivă fiecare cifră din sesiune, deci nu
 * există aici un id de îndreptat spre altcineva. Semnătura e păstrată verbatim.
 */
export function getMyPayroll(_params: Record<string, never> = {}) {
  return apiGet<MyPayrollResponse>('/me/payroll');
}

