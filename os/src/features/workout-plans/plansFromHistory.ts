import type { WorkoutEntry, WorkoutSession } from '../workout-log/types'

/**
 * Planuri scoase din antrenamentele deja făcute.
 *
 * Un plan e o listă de exerciții cu un nume. Exact asta e și un antrenament
 * din istoric, doar că trecut. Cine se antrenează după un tipar — Push, Pull,
 * Legs — l-a scris deja de zeci de ori în log; nu are rost să-l tasteze încă o
 * dată ca să-l poată porni cu un buton.
 *
 * Se grupează după numele antrenamentului, iar lista de exerciții vine din
 * cea mai recentă ședință cu numele ăla: dacă ai schimbat ceva în program,
 * planul ia varianta nouă, nu pe cea de acum șase luni.
 */

export interface HistoryPlan {
  name: string
  exerciseIds: string[]
  exerciseNames: string[]
  /** Ultima dată când a fost făcut, ca să se vadă ce e proaspăt. */
  lastDate: string
  /** De câte ori apare în istoric — un tipar făcut o dată nu e un tipar. */
  times: number
}

/** Mai nou întâi; la aceeași zi decide ora, iar ședințele fără oră vin ultimele. */
function newerFirst(a: WorkoutSession, b: WorkoutSession): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date)
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
}

/**
 * Ordinea în care au fost făcute exercițiile, nu ordinea în care sunt salvate:
 * logul e ținut cu cel mai nou primul, deci luat ca atare ar întoarce
 * antrenamentul pe dos.
 */
function exercisesOf(session: WorkoutSession, entries: WorkoutEntry[]): { ids: string[]; names: string[] } {
  const mine = entries
    .filter(entry => entry.sessionId === session.id)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  const byId = new Map<string, string>()
  /* Când ședința a fost pornită din runner, ordinea ei e cea gândită de om;
     o păstrăm, dar numai pentru exercițiile care chiar au fost lucrate. */
  const order = session.plannedExerciseIds?.length
    ? [...session.plannedExerciseIds, ...mine.map(entry => entry.exerciseId)]
    : mine.map(entry => entry.exerciseId)

  const names = new Map(mine.map(entry => [entry.exerciseId, entry.exerciseName]))
  for (const id of order) {
    if (!byId.has(id) && names.has(id)) byId.set(id, names.get(id) as string)
  }
  return { ids: [...byId.keys()], names: [...byId.values()] }
}

export function plansFromHistory(sessions: WorkoutSession[], entries: WorkoutEntry[]): HistoryPlan[] {
  const groups = new Map<string, WorkoutSession[]>()
  for (const session of sessions) {
    const name = session.name?.trim()
    if (!name) continue
    const list = groups.get(name)
    if (list) list.push(session)
    else groups.set(name, [session])
  }

  const plans: HistoryPlan[] = []
  for (const [name, group] of groups) {
    const ordered = [...group].sort(newerFirst)
    /* Cea mai recentă ședință poate fi una începută și abandonată, fără nimic
       scris în ea. Coborâm până la prima care chiar are exerciții. */
    for (const session of ordered) {
      const { ids, names } = exercisesOf(session, entries)
      if (ids.length === 0) continue
      plans.push({
        name, exerciseIds: ids, exerciseNames: names,
        lastDate: ordered[0].date, times: group.length,
      })
      break
    }
  }

  return plans.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name))
}
