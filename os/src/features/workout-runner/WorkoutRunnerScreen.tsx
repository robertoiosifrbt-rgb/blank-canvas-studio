import { useState } from 'react'
import { useExercises, useFieldTypes } from '../exercises'
import { useWorkoutLog } from '../workout-log/useWorkoutLog'
import { useWorkoutSessions } from '../workout-log/useWorkoutSessions'
import { byOldestFirst } from '../workout-log/types'
import { useWorkoutPlans } from '../workout-plans'
import { StorageNotice } from '../../shared/StorageNotice'
import { todayLocal } from '../../shared/localDate'
import { ExercisePicker } from './ExercisePicker'
import { WorkoutRunner } from './WorkoutRunner'
import './workout-runner.css'

interface WorkoutRunnerScreenProps {
  /** Resume this session, or omit to pick exercises for a new one. */
  sessionId?: string
  onExit: () => void
}

/**
 * Owns the storage hooks for the runner.
 *
 * This is deliberately mounted only while the runner is on screen. Two live
 * copies of `usePersistedState` for the same key do not see each other's
 * writes within a tab, so the runner is kept short-lived: it reads storage
 * when it opens and the pages behind it re-read when it closes.
 */
export function WorkoutRunnerScreen({ sessionId, onExit }: WorkoutRunnerScreenProps) {
  const { exercises, addFieldToExercise, error: exercisesError, dismissError: dismissExercisesError } = useExercises()
  const { fieldTypes, allFieldTypes } = useFieldTypes()
  const {
    plans,
    addPlan,
    deletePlan,
    error: plansError,
    dismissError: dismissPlansError,
  } = useWorkoutPlans()
  const {
    sessions,
    addSession,
    finishSession,
    error: sessionsError,
    dismissError: dismissSessionsError,
  } = useWorkoutSessions()
  const {
    entries,
    addEntry,
    updateEntry,
    getLastEntry,
    error: entriesError,
    dismissError: dismissEntriesError,
  } = useWorkoutLog()
  const [startedId, setStartedId] = useState('')

  const activeId = sessionId ?? startedId
  const session = sessions.find((candidate) => candidate.id === activeId)

  function dismissAll() {
    dismissExercisesError()
    dismissPlansError()
    dismissSessionsError()
    dismissEntriesError()
  }

  function handleStart(name: string, exerciseIds: string[]): boolean {
    const created = addSession({ date: todayLocal(), name, plannedExerciseIds: exerciseIds })
    if (!created) return false
    setStartedId(created.id)
    return true
  }

  const notice = (
    <StorageNotice message={exercisesError ?? plansError ?? sessionsError ?? entriesError} onDismiss={dismissAll} />
  )

  if (!session) {
    return (
      <div className="runner-root">
        {notice}
        <ExercisePicker
          exercises={exercises}
          plans={plans}
          onCancel={onExit}
          onStart={handleStart}
          onSavePlan={addPlan}
          onDeletePlan={deletePlan}
        />
      </div>
    )
  }

  // Oldest first, so an exercise logged into this session from the log page
  // joins the end of the runner's queue in the order it was done.
  const sessionEntries = entries.filter((entry) => entry.sessionId === session.id).sort(byOldestFirst)

  return (
    <div className="runner-root">
      {notice}
      <WorkoutRunner
        session={session}
        entries={sessionEntries}
        exercises={exercises}
        fieldTypes={fieldTypes}
        historyFieldTypes={allFieldTypes}
        getLastEntry={(exerciseId) => getLastEntry(exerciseId, session.id)}
        onAddTrack={addFieldToExercise}
        onSaveEntry={(entry) => addEntry({ ...entry, sessionId: session.id, date: session.date })}
        onUpdateEntry={updateEntry}
        onFinishWorkout={() => finishSession(session.id)}
        onExit={onExit}
      />
    </div>
  )
}
