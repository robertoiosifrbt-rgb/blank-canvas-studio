import { useMemo, useState } from 'react'
import type { WorkoutEntry, WorkoutSession } from '../workout-log/types'
import { plansFromHistory } from './plansFromHistory'
import type { WorkoutPlan } from './types'
import './plansFromHistory.css'

interface PlansFromHistoryProps {
  sessions: WorkoutSession[]
  entries: WorkoutEntry[]
  plans: WorkoutPlan[]
  onSave: (name: string, exerciseIds: string[]) => boolean
  onClose: () => void
}

/**
 * Ce ai făcut deja, oferit ca plan de pornit cu un buton.
 *
 * Cele care există deja ca plan rămân în listă, dar nebifate: e util să vezi
 * că sunt acolo, iar dacă programul s-a schimbat le poți face din nou, cu
 * varianta nouă de exerciții.
 */
export function PlansFromHistory({ sessions, entries, plans, onSave, onClose }: PlansFromHistoryProps) {
  const found = useMemo(() => plansFromHistory(sessions, entries), [sessions, entries])
  const existing = useMemo(() => new Set(plans.map(plan => plan.name.toLowerCase())), [plans])

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(found.filter(plan => !existing.has(plan.name.toLowerCase())).map(plan => plan.name)),
  )
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(name: string) {
    setPicked(current => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function save() {
    setError(null)
    let saved = 0
    for (const plan of found) {
      if (!picked.has(plan.name)) continue
      if (!onSave(plan.name, plan.exerciseIds)) {
        setError('Nu s-au putut salva toate — vezi mesajul de stocare. Cele salvate au rămas.')
        break
      }
      saved += 1
    }
    setDone(saved)
  }

  if (found.length === 0) {
    return (
      <section className="history-plans" aria-label="Planuri din istoric">
        <p>Nu am găsit antrenamente cu nume și exerciții din care să scot planuri.</p>
        <button type="button" onClick={onClose}>Închide</button>
      </section>
    )
  }

  if (done !== null) {
    return (
      <section className="history-plans" aria-label="Planuri din istoric">
        <p>{done === 0 ? 'Nu am salvat niciun plan.' : `${done} ${done === 1 ? 'plan salvat' : 'planuri salvate'}.`}</p>
        <p className="history-plans-hint">
          Le găsești când începi un antrenament, la „Saved routines". Apeși pe unul și pornește direct.
        </p>
        {error && <p className="history-plans-error">{error}</p>}
        <button type="button" onClick={onClose}>Gata</button>
      </section>
    )
  }

  return (
    <section className="history-plans" aria-label="Planuri din istoric">
      <p className="history-plans-hint">
        Antrenamentele pe care le-ai făcut, gata de transformat în planuri. Exercițiile sunt
        cele din ultima dată când l-ai făcut.
      </p>

      <ul className="history-plans-list">
        {found.map(plan => {
          const already = existing.has(plan.name.toLowerCase())
          return (
            <li key={plan.name} className="history-plans-row">
              <label>
                <input type="checkbox" checked={picked.has(plan.name)} onChange={() => toggle(plan.name)} />
                <span className="history-plans-copy">
                  <strong>
                    {plan.name}
                    {already && <em className="history-plans-tag">deja salvat</em>}
                  </strong>
                  <span className="history-plans-meta">
                    {plan.exerciseIds.length} exerciții · făcut de {plan.times} ori · ultima dată {plan.lastDate}
                  </span>
                  <span className="history-plans-ex">{plan.exerciseNames.join(' · ')}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {error && <p className="history-plans-error">{error}</p>}

      <div className="history-plans-actions">
        <button type="button" onClick={onClose}>Renunță</button>
        <button type="submit" onClick={save} disabled={picked.size === 0}>
          Creează {picked.size} {picked.size === 1 ? 'plan' : 'planuri'}
        </button>
      </div>
    </section>
  )
}
