/**
 * 🔴 §43 „Calendar display" (Sesiunea 150) — **CE STĂ PE CARE ZI, ÎNTR-UN SINGUR LOC.**
 *
 * ⛔ **De ce e un fișier și nu două `useMemo` în pagină:** `SchedulePage.tsx` e la clichetul lui de
 * mărime, iar regula spune ce se face atunci — iese cod, cifra nu urcă (`AGENT_RULES` §7). ⚠️ Iar
 * gruparea pe zile e chiar partea care **nu** e randare: se poate citi și verifica fără un ecran.
 *
 * ⚠️ **Aceeași formă pentru vizite și pentru sarcini**, deliberat: două potriviri diferite pe
 * aceleași zile ar fi putut da rezultate diferite pe aceeași grilă.
 */

/** Ce citește gruparea din intrarea de calendar. ⚠️ Structural, nu tipul complet al ecranului. */
type DayEntry = {
  date: string;
  startMinutes: number | null;
  customerName: string;
};

export type ScheduleTask = {
  id: string;
  taskId: number;
  title: string;
  /** `YYYY-MM-DD`, ca zilele grilei: ecranul le potrivește direct, fără aritmetică de fus. */
  dueDate: string;
  priority: string;
  assignedTo: string | null;
};

function bucket<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(keyOf(row)) ?? [];
    list.push(row);
    map.set(keyOf(row), list);
  }
  return map;
}

/**
 * Vizitele pe ziua lor.
 *
 * ⚠️ Vizitele cu oră primele, în ordinea ceasului; cele fără oră la **finalul** zilei — sunt muncă
 * reală, deci nu se ascund și nu se lipesc la miezul nopții.
 */
export function groupEntriesByDay<T extends DayEntry>(entries: T[] = []): Map<string, T[]> {
  const map = bucket(entries, e => e.date);
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.startMinutes == null && b.startMinutes == null) return a.customerName.localeCompare(b.customerName);
      if (a.startMinutes == null) return 1;
      if (b.startMinutes == null) return -1;
      return a.startMinutes - b.startMinutes;
    });
  }
  return map;
}

/**
 * Sarcinile pe ziua termenului.
 *
 * ⛔ **Prioritatea mare sus, nu alfabetic:** dacă o zi arată doar primele două, acelea trebuie să fie
 * cele care contează.
 */
export function groupTasksByDay(tasks: ScheduleTask[] = []): Map<string, ScheduleTask[]> {
  const map = bucket(tasks, t => t.dueDate);
  const rank = (p: string) => (p === 'High' ? 0 : p === 'Medium' ? 1 : 2);
  for (const list of map.values()) list.sort((a, b) => rank(a.priority) - rank(b.priority) || a.taskId - b.taskId);
  return map;
}

