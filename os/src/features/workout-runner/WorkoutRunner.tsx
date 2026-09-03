import { useEffect, useMemo, useState } from 'react'
import type { Exercise, FieldType } from '../exercises'
import { parseBounded } from '../../shared/numbers'
import { formatClock } from '../../shared/formatClock'
import { dayLabel } from '../../shared/localDate'
import { ExerciseMuscleMap } from '../body-overview'
import { formatSet } from '../workout-log/formatSet'
import {
  SET_VALUE_BOUNDS,
  type NewExerciseEntry,
  type SetValues,
  type WorkoutEntry,
  type WorkoutSession,
} from '../workout-log/types'

type DraftSet = Record<string, string>

interface WorkoutRunnerProps {
  session: WorkoutSession
  /** Entries already logged in this session. */
  entries: WorkoutEntry[]
  /** The whole library, used to resolve the session's planned exercise ids. */
  exercises: Exercise[]
  fieldTypes: FieldType[]
  /** Includes archived field types, so an old log still shows its labels. */
  historyFieldTypes: FieldType[]
  /** The last log for this exercise from *before* this session, if there is one. */
  getLastEntry: (exerciseId: string) => WorkoutEntry | undefined
  /** Adds a track to an exercise that has none, so it can be logged from here. */
  onAddTrack: (exerciseId: string, fieldId: string) => boolean
  onSaveEntry: (entry: NewExerciseEntry) => boolean
  onUpdateEntry: (entryId: string, entry: NewExerciseEntry) => boolean
  onFinishWorkout: () => boolean
  onExit: () => void
}

const DEFAULT_ROWS = 3

/** Turns a saved entry back into editable text, so re-opening an exercise shows what you logged. */
function entryToRows(entry: WorkoutEntry): DraftSet[] {
  return entry.sets.map((set) =>
    Object.fromEntries(Object.entries(set).map(([fieldId, value]) => [fieldId, String(value)])),
  )
}

export function WorkoutRunner({
  session,
  entries,
  exercises,
  fieldTypes,
  historyFieldTypes,
  getLastEntry,
  onAddTrack,
  onSaveEntry,
  onUpdateEntry,
  onFinishWorkout,
  onExit,
}: WorkoutRunnerProps) {
  // The queue is the plan, plus anything already logged into this session that
  // the plan does not mention (an exercise added from the log page). Exercises
  // deleted from the library drop out — their logged sets stay in the log.
  const queue = useMemo(() => {
    const planned = session.plannedExerciseIds ?? []
    const ordered: string[] = [...planned]
    for (const entry of entries) {
      if (!ordered.includes(entry.exerciseId)) ordered.push(entry.exerciseId)
    }
    return ordered
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
  }, [session.plannedExerciseIds, entries, exercises])

  const entryFor = (exerciseId: string) => entries.find((entry) => entry.exerciseId === exerciseId)

  const [index, setIndex] = useState(() => {
    const planned = session.plannedExerciseIds ?? []
    const logged = new Set(entries.map((entry) => entry.exerciseId))
    const firstUnlogged = planned.findIndex((id) => !logged.has(id))
    return firstUnlogged === -1 ? 0 : firstUnlogged
  })
  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>({})
  const [checks, setChecks] = useState<Record<string, boolean[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const startMs = session.createdAt ? new Date(session.createdAt).getTime() : Number.NaN
  const elapsedSeconds = Number.isFinite(startMs) ? Math.floor(Math.max(0, now - startMs) / 1000) : 0

  const safeIndex = queue.length === 0 ? 0 : Math.min(index, queue.length - 1)
  const current: Exercise | undefined = queue[safeIndex]
  const currentEntry = current ? entryFor(current.id) : undefined
  /** What you did the last time you trained this exercise, before today's session. */
  const previousEntry = current ? getLastEntry(current.id) : undefined
  const isLast = safeIndex >= queue.length - 1
  const next = queue[safeIndex + 1]

  const doneCount = queue.filter((exercise) => entryFor(exercise.id)).length
  const percent = queue.length === 0 ? 0 : Math.round((doneCount / queue.length) * 100)

  function defaultRows(exercise: Exercise): DraftSet[] {
    const saved = entryFor(exercise.id)
    if (saved) return entryToRows(saved)
    // Start with as many blank rows as you did last time, so the usual case is
    // "fill in the numbers" rather than "add three rows first".
    const last = getLastEntry(exercise.id)
    const count = last ? Math.max(1, last.sets.length) : DEFAULT_ROWS
    return Array.from({ length: count }, () => ({}))
  }

  const rows: DraftSet[] = current ? (drafts[current.id] ?? defaultRows(current)) : []
  const rowChecks: boolean[] = current
    ? (checks[current.id] ?? rows.map(() => Boolean(currentEntry)))
    : []
  const columns = current
    ? current.fields
        .map((fieldId) => fieldTypes.find((field) => field.id === fieldId))
        .filter((field): field is FieldType => Boolean(field))
    : []

  function writeRows(nextRows: DraftSet[], nextChecks: boolean[]) {
    if (!current) return
    setDrafts((prev) => ({ ...prev, [current.id]: nextRows }))
    setChecks((prev) => ({ ...prev, [current.id]: nextChecks }))
  }

  function updateField(rowIndex: number, fieldId: string, value: string) {
    setError(null)
    writeRows(
      rows.map((row, i) => {
        if (i !== rowIndex) return row
        const nextRow = { ...row }
        if (value === '') delete nextRow[fieldId]
        else nextRow[fieldId] = value
        return nextRow
      }),
      rowChecks,
    )
  }

  function toggleCheck(rowIndex: number) {
    writeRows(rows, rowChecks.map((done, i) => (i === rowIndex ? !done : done)))
  }

  function addSet() {
    writeRows([...rows, {}], [...rowChecks, false])
  }

  function removeLastSet() {
    if (rows.length <= 1) return
    writeRows(rows.slice(0, -1), rowChecks.slice(0, -1))
  }

  /** Gives an exercise its first track without leaving the workout. */
  function addTrack(fieldId: string) {
    if (!current) return
    if (!onAddTrack(current.id, fieldId)) {
      setError('Could not add the track — see the storage message.')
      return
    }
    setError(null)
  }

  /** Copies the last row's numbers into a new one — the common case of another set at the same weight. */
  function repeatLastSet() {
    writeRows([...rows, { ...rows[rows.length - 1] }], [...rowChecks, false])
  }

  const hasInput = rows.some((row) => Object.values(row).some((value) => value.trim() !== ''))
  /** The first set you have not ticked off yet — highlighted as the one you are on. */
  const activeRow = rowChecks.findIndex((done) => !done)

  function collectSets(): { ok: true; sets: SetValues[] } | { ok: false; error: string } {
    const collected: SetValues[] = []
    for (const [rowIndex, row] of rows.entries()) {
      const set: SetValues = {}
      for (const field of columns) {
        const raw = row[field.id]
        if (raw === undefined || raw.trim() === '') continue
        const parsed = parseBounded(raw, `Set ${rowIndex + 1} — ${field.label}`, SET_VALUE_BOUNDS)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        set[field.id] = parsed.value
      }
      if (Object.keys(set).length > 0) collected.push(set)
    }
    return { ok: true, sets: collected }
  }

  /** Saves what is on screen. An exercise with nothing filled in counts as skipped, not as an error. */
  function commitCurrent(): boolean {
    if (!current) return true
    const result = collectSets()
    if (!result.ok) {
      setError(result.error)
      return false
    }
    if (result.sets.length === 0) return true

    const payload: NewExerciseEntry = {
      exerciseId: current.id,
      exerciseName: current.name,
      sets: result.sets,
    }
    const saved = currentEntry ? onUpdateEntry(currentEntry.id, payload) : onSaveEntry(payload)
    if (!saved) {
      setError('Not saved — see the storage message. Your sets are still on screen.')
      return false
    }
    setError(null)
    return true
  }

  function goToExercise(nextIndex: number) {
    if (!commitCurrent()) return
    setMenuOpen(false)
    setIndex(Math.max(0, Math.min(nextIndex, queue.length - 1)))
  }

  function finishWorkout() {
    if (!commitCurrent()) return
    if (!onFinishWorkout()) {
      setError('Could not finish the workout — see the storage message.')
      return
    }
    setMenuOpen(false)
    onExit()
  }

  if (queue.length === 0 || !current) {
    return (
      <section className="runner-screen" aria-label="Workout runner">
        <header className="runner-header">
          <button type="button" className="runner-icon-button" onClick={onExit} aria-label="Back">
            ‹
          </button>
          <div className="runner-header-title">
            <strong>{session.name || 'Workout'}</strong>
          </div>
          <span className="runner-icon-button runner-icon-placeholder" aria-hidden="true" />
        </header>
        <div className="runner-picker-body">
          <p className="runner-empty">
            This workout has no exercises left to run — they were removed from your library. The sets you
            already logged are safe in the workout log.
          </p>
        </div>
        <footer className="runner-footer">
          <button type="button" className="runner-primary-action" onClick={finishWorkout}>
            Finish Workout
          </button>
        </footer>
      </section>
    )
  }

  return (
    <section className="runner-screen" aria-label="Workout runner">
      <header className="runner-header">
        <button type="button" className="runner-icon-button" onClick={onExit} aria-label="Back">
          ‹
        </button>
        <div className="runner-header-title">
          <strong>{session.name || 'Workout'}</strong>
        </div>
        <button
          type="button"
          className="runner-icon-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Workout options"
          aria-expanded={menuOpen}
        >
          ···
        </button>
      </header>

      {menuOpen && (
        <div className="runner-menu">
          <button type="button" onClick={() => goToExercise(safeIndex - 1)} disabled={safeIndex === 0}>
            Previous exercise
          </button>
          <button type="button" onClick={finishWorkout}>
            Finish workout
          </button>
          <button type="button" onClick={onExit}>
            Leave without finishing
          </button>
        </div>
      )}

      <div className="runner-clock">
        <strong aria-live="off">{formatClock(elapsedSeconds, true)}</strong>
        <span>Elapsed Time</span>
      </div>

      <div className="runner-progress">
        <div className="runner-progress-labels">
          <span>{`${doneCount} of ${queue.length} exercises`}</span>
          <span>{`${percent}%`}</span>
        </div>
        <div className="runner-progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="runner-body">
        <article className="runner-exercise-card">
          <h1>{current.name}</h1>

          <div className="runner-exercise-visual">
            <ExerciseMuscleMap
              primaryMuscles={current.primaryMuscles}
              secondaryMuscles={current.secondaryMuscles}
              exerciseName={current.name}
            />
            <span className="runner-exercise-muscles">
              <strong>{current.primaryMuscles || current.category || 'Exercise'}</strong>
              {current.secondaryMuscles && <small>{current.secondaryMuscles}</small>}
            </span>
          </div>

          {previousEntry && (
            <div className="runner-last-time">
              <span className="runner-last-time-head">Last time · {dayLabel(previousEntry.date)}</span>
              <ol className="runner-last-time-sets">
                {previousEntry.sets.map((set, setIndex) => (
                  <li key={setIndex}>
                    <span aria-hidden="true">{setIndex + 1}</span>
                    {formatSet(set, historyFieldTypes)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {columns.length === 0 ? (
            fieldTypes.length === 0 ? (
              <p className="runner-empty">
                There are no tracks to log with yet. Add one under Workout → Exercises.
              </p>
            ) : (
              <div className="runner-no-tracks">
                <p>Nothing to log yet — {current.name} tracks nothing. Pick what you want to write down:</p>
                <ul>
                  {fieldTypes.map((field) => (
                    <li key={field.id}>
                      <button type="button" onClick={() => addTrack(field.id)}>
                        {field.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <small>It stays on this exercise, so next time the table is already here.</small>
              </div>
            )
          ) : (
            <>
              <div className="runner-sets" style={{ '--runner-columns': columns.length } as React.CSSProperties}>
                <div className="runner-sets-head" aria-hidden="true">
                  <span>SET</span>
                  {columns.map((field) => (
                    <span key={field.id}>{field.label.toUpperCase()}</span>
                  ))}
                  <span />
                </div>
                {rows.map((row, rowIndex) => (
                  <div
                    className={`runner-set-row ${rowChecks[rowIndex] ? 'is-done' : ''} ${rowIndex === activeRow ? 'is-current' : ''}`}
                    key={rowIndex}
                  >
                    <span className="runner-set-number">{rowIndex + 1}</span>
                    {columns.map((field) => (
                      <input
                        key={field.id}
                        type="number"
                        inputMode="decimal"
                        step={0.1}
                        min={SET_VALUE_BOUNDS.min}
                        max={SET_VALUE_BOUNDS.max}
                        aria-label={`Set ${rowIndex + 1} ${field.label}`}
                        value={row[field.id] ?? ''}
                        onChange={(event) => updateField(rowIndex, field.id, event.target.value)}
                      />
                    ))}
                    <button
                      type="button"
                      className="runner-set-check"
                      aria-pressed={Boolean(rowChecks[rowIndex])}
                      aria-label={`${rowChecks[rowIndex] ? 'Unmark' : 'Mark'} set ${rowIndex + 1} as done`}
                      onClick={() => toggleCheck(rowIndex)}
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>

              <div className="runner-set-controls">
                <button
                  type="button"
                  className="runner-set-tweak"
                  onClick={removeLastSet}
                  disabled={rows.length <= 1}
                  aria-label="Remove last set"
                >
                  −
                </button>
                <button type="button" className="runner-add-set" onClick={addSet}>
                  Add Set
                </button>
                <button
                  type="button"
                  className="runner-set-tweak"
                  onClick={repeatLastSet}
                  aria-label="Repeat last set"
                >
                  +
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="runner-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="runner-finish-exercise"
            onClick={() => (isLast ? finishWorkout() : goToExercise(safeIndex + 1))}
          >
            {isLast ? 'Finish Workout' : hasInput ? 'Finish Exercise' : 'Skip Exercise'}
            <span aria-hidden="true">›</span>
          </button>
        </article>

        {next && (
          <button type="button" className="runner-next-card" onClick={() => goToExercise(safeIndex + 1)}>
            <span className="runner-next-glyph" aria-hidden="true">
              ▸
            </span>
            <span className="runner-next-copy">
              <small>Next</small>
              <strong>{next.name}</strong>
            </span>
            <span className="runner-next-sets">
              {(() => {
                const last = getLastEntry(next.id)
                return last ? `${last.sets.length} sets` : ''
              })()}
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
    </section>
  )
}
