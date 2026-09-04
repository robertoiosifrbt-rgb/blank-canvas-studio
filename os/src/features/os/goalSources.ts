import { gymMetric, gymReadings } from './gymBridge'
import type { Goal, OsData } from './types'

/**
 * Obiectivele legate de o măsurătoare din sală își iau citirile de acolo.
 *
 * Se rezolvă la citire, nu la scriere: citirile rămân ale sălii, nu se copiază
 * în obiectiv. Altfel ar exista două adevăruri — ce ai măsurat și ce am copiat
 * eu ultima dată — și s-ar despărți în ziua în care corectezi o măsurătoare.
 *
 * Valoarea de plecare rămâne a obiectivului: e ziua în care ai hotărât ținta,
 * nu prima măsurătoare pe care ai făcut-o vreodată.
 */
export function resolveGoal(goal: Goal): Goal {
  if (!goal.source?.startsWith('gym:')) return goal
  const field = goal.source.slice(4)
  const metric = gymMetric(field)
  if (!metric) return goal

  /* Măsurătorile dinaintea deciziei nu spun nimic despre progresul spre țintă
     — pot chiar să-l arate invers, dacă atunci erai mai aproape. */
  const from = goal.reads?.[0]?.date ?? goal.createdAt?.slice(0, 10) ?? ""
  const reads = gymReadings(field).filter(read => read.date >= from)

  return {
    ...goal,
    unit: goal.unit ?? metric.unit,
    reads: [...(goal.reads ?? []), ...reads],
  }
}

export const resolveGoals = (data: OsData): OsData => ({
  ...data,
  goals: Object.fromEntries(Object.entries(data.goals).map(([id, goal]) => [id, resolveGoal(goal)])),
})
