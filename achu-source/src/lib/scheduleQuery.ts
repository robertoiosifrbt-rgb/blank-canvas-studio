/**
 * §11 (Sesiunea 158) — CE ANUME SE CERE DE LA SERVER PENTRU ORAR.
 *
 * ─── 🔴 De ce e o funcție, și nu două obiecte scrise pe loc ─────────────────
 * ⚠️ Aceleași filtre sunt cerute de **două** ori: o dată pentru ecran, o dată pentru **export**.
 * ⛔ Scrise separat, s-ar despărți la primul filtru nou, iar atunci fișierul descărcat n-ar mai fi
 * tabelul de pe ecran — cea mai proastă formă de greșeală la un export, fiindcă nimeni nu compară
 * un CSV cu ecranul: omul îl trimite contabilului.
 *
 * ⚠️ **Căutarea NU e aici, dinadins.** Ea se aplică pe rândurile deja aduse (`scheduleSearch.ts`),
 * deci nu poate intra într-o cerere — iar ecranul spune asta când e activă.
 */

/** ⛔ Stările pe care le desenează orarul. Lista vie e a serverului (`VALID_JOB_STATUSES`). */
const DRAWN_STATUSES = ['Booked', 'Confirmed', 'In Progress', 'Completion Review', 'Completed', 'No Access'];

export type ScheduleFilters = {
  from: string;
  to: string;
  /** `'all'` = fără filtru, exact cum o spune controlul de pe ecran. */
  cleanerId: string;
  teamId: string;
  showCancelled: boolean;
  showEnquiries: boolean;
};

/**
 * 🔴 **`statuses: undefined` cât timp amândouă comutatoarele sunt aprinse**, și e o hotărâre, nu o
 * scurtătură: `undefined` înseamnă „tot", deci o stare adăugată mâine pe server apare singură în
 * orar. ⛔ O listă scrisă mereu explicit ar fi ascuns-o tăcut — exact felul de gol pe care nimeni
 * nu-l raportează, fiindcă o vizită care nu se arată nu se reclamă.
 */
export function scheduleParams(f: ScheduleFilters): {
  from: string; to: string; cleanerId?: string; teamId?: string; statuses?: string[];
} {
  const everything = f.showCancelled && f.showEnquiries;
  return {
    from: f.from,
    to: f.to,
    cleanerId: f.cleanerId === 'all' ? undefined : f.cleanerId,
    teamId: f.teamId === 'all' ? undefined : f.teamId,
    statuses: everything ? undefined : [
      ...(f.showEnquiries ? ['Enquiry'] : []),
      ...DRAWN_STATUSES,
      ...(f.showCancelled ? ['Cancelled'] : []),
    ],
  };
}

