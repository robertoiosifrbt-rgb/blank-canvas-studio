import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useExercises, useFieldTypes } from '../exercises'
import { StorageNotice } from '../../shared/StorageNotice'
import { todayLocal } from '../../shared/localDate'
import { useWorkoutLog } from './useWorkoutLog'
import { useWorkoutSessions } from './useWorkoutSessions'
import { SessionCard } from './SessionCard'
import { SessionForm } from './SessionForm'
import { WorkoutCalendar } from './WorkoutCalendar'
import { currentMonth, monthLabel, monthOf } from './calendarMonth'
import { byOldestFirst } from './types'
import './workout-log.css'
import { PageHeader } from '../../shared/PageHeader'

interface WorkoutLogPageProps {
  /**
   * Rândul de tab-uri Log / Exercises, dat de shell.
   *
   * Se randează **sub** titlu, nu deasupra lui: fiecare ecran din target începe
   * cu propriul titlu, iar tab-urile stau sub el — ca la Body. Deasupra, ele
   * arătau ca un al doilea header global, exact lucrul scos în etapa 1.
   */
  tabs?: ReactNode
}

export function WorkoutLogPage({ tabs }: WorkoutLogPageProps = {}) {
  const { exercises } = useExercises()
  const { fieldTypes, allFieldTypes } = useFieldTypes()
  const {
    sessions,
    addSession,
    updateSession,
    restoreSession,
    finishSession,
    deleteSession,
    error: sessionsError,
    dismissError: dismissSessionsError,
  } = useWorkoutSessions()
  const {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    deleteEntriesForSession,
    restoreEntries,
    getLastEntry,
    backfillSessionIds,
    updateEntriesDate,
    error: entriesError,
    dismissError: dismissEntriesError,
  } = useWorkoutLog()
  const [openSessionId, setOpenSessionId] = useState('')
  // Opens on the month you last trained in, not on today's: coming back after
  // a few weeks off, an empty current month is the least useful thing to show.
  const [month, setMonth] = useState(() =>
    sessions[0] ? monthOf(sessions[0].date) : currentMonth(),
  )
  const [selectedDay, setSelectedDay] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const migrated = useRef(false)
  const autoOpened = useRef(false)

  useEffect(() => {
    if (migrated.current) return
    const legacyDates = [...new Set(entries.filter((e) => !e.sessionId).map((e) => e.date))]
    if (legacyDates.length === 0) return
    migrated.current = true

    const sessionIdByDate: Record<string, string> = {}
    for (const date of legacyDates) {
      const existing = sessions.find((s) => s.date === date && !s.name)
      if (existing) {
        sessionIdByDate[date] = existing.id
        continue
      }
      const created = addSession({ date, name: '' })
      if (!created) {
        // Storage refused the write. Leave the remaining entries untouched and
        // allow another attempt on the next mount rather than half-migrating.
        migrated.current = false
        return
      }
      sessionIdByDate[date] = created.id
    }
    backfillSessionIds(sessionIdByDate)
  }, [entries, sessions, addSession, backfillSessionIds])

  useEffect(() => {
    if (autoOpened.current || openSessionId) return
    const todaysSession = sessions.find((s) => s.date === todayLocal())
    if (todaysSession) {
      autoOpened.current = true
      setOpenSessionId(todaysSession.id)
    }
  }, [sessions, openSessionId])

  /**
   * Keeps the calendar on the session you just touched. Without this, giving a
   * session a date in another month makes it vanish: the list follows the
   * month on screen, and the session is no longer in it.
   */
  function followSession(date: string) {
    setMonth(monthOf(date))
    setSelectedDay((current) => (current && current !== date ? '' : current))
  }

  function handleCreate(date: string, name: string): boolean {
    autoOpened.current = true
    const created = addSession({ date, name })
    if (!created) return false
    setActionError(null)
    setOpenSessionId(created.id)
    setCreating(false)
    followSession(date)
    return true
  }

  function handleToggle(id: string) {
    autoOpened.current = true
    setOpenSessionId((prev) => (prev === id ? '' : id))
  }

  /*
   * `durationSeconds` used to be missing from this signature, and the callsite
   * below dropped it: the edit form collected a duration, validated it, handed
   * it up — and it went nowhere. The field could never change anything.
   */
  function handleUpdateSession(sessionId: string, date: string, name: string, durationSeconds?: number): boolean {
    // Find the session being updated to save old values for potential revert.
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return false

    // Update session first.
    if (!updateSession(sessionId, date, name, durationSeconds)) return false

    // The session's date is denormalised onto its entries so history stays
    // consistent. If the second write fails, revert the first to keep them in step.
    if (!updateEntriesDate(sessionId, date)) {
      // Put the whole session back, not just its date and name — a partial
      // revert after a duration change would keep the new duration.
      if (!restoreSession(session)) {
        // Revert itself failed — now we're in a bad state where neither could
        // be fixed. Inform the user clearly and let them retry manually.
        setActionError(
          'ERROR: Session and entry dates are now out of sync and both revert attempts failed. ' +
            'Free some storage space and edit the session again to fix.',
        )
        return false
      }
      // Revert succeeded. Report the original update failure.
      setActionError(
        'The session was not saved — storage is full. Free some space and try again.',
      )
      return false
    }
    setActionError(null)
    followSession(date)
    return true
  }

  function handleUpdateEntry(entryId: string, entry: any): boolean {
    return updateEntry(entryId, entry)
  }

  function handleDeleteEntry(entryId: string): boolean {
    return deleteEntry(entryId)
  }

  function handleDeleteSession(sessionId: string): boolean {
    const sessionEntries = entries.filter((entry) => entry.sessionId === sessionId)

    // Delete child entries first. If this write is refused, the session has not
    // been touched and the database is still consistent.
    if (sessionEntries.length > 0 && !deleteEntriesForSession(sessionId)) {
      setActionError('The workout was not deleted — storage refused the change. Nothing was removed.')
      return false
    }

    if (deleteSession(sessionId)) {
      setActionError(null)
      return true
    }

    // The session write failed after its entries were removed. Put those exact
    // entries back so a failed delete behaves as if nothing happened.
    if (sessionEntries.length > 0 && !restoreEntries(sessionEntries)) {
      setActionError(
        'ERROR: The workout could not be deleted and its exercises could not be restored. ' +
          'Free some storage space and reload the app before changing anything else.',
      )
      return false
    }

    setActionError('The workout was not deleted — storage refused the change. Nothing was removed.')
    return false
  }

  function handleFinishSession(sessionId: string): boolean {
    return finishSession(sessionId)
  }

  function dismissAll() {
    dismissSessionsError()
    dismissEntriesError()
    setActionError(null)
  }

  const trainedDays = new Set(sessions.map((session) => session.date))
  // The calendar and the list have to agree, so the list follows the month on
  // screen — and narrows to one day once you tap it.
  const visibleSessions = sessions.filter((session) =>
    selectedDay ? session.date === selectedDay : monthOf(session.date) === month,
  )

  return (
    <section>
      <PageHeader
        title="Workout Log"
        subtitle={`${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} recorded`}
      />

      {tabs}

      <WorkoutCalendar
        month={month}
        trainedDays={trainedDays}
        selected={selectedDay}
        today={todayLocal()}
        onMonthChange={(next) => {
          setMonth(next)
          setSelectedDay('')
        }}
        onSelect={setSelectedDay}
      />

      {/*
       * A coordinated action can produce a more precise outcome than the raw
       * storage hook error (for example: rollback succeeded, so nothing was
       * removed). Show that action result first instead of hiding it behind the
       * generic "out of storage" message.
       */}
      <StorageNotice message={actionError ?? sessionsError ?? entriesError} onDismiss={dismissAll} />

      <div className="section-header">
        {creating ? (
          <h2>New Session</h2>
        ) : (
          <>
            <h2>{selectedDay || monthLabel(month)}</h2>
            <button type="button" className="add-button" onClick={() => setCreating(true)}>
              + New session
            </button>
          </>
        )}
      </div>

      {creating && (
        <SessionForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      )}

      {sessions.length === 0 && !creating && <p>No sessions yet.</p>}

      {sessions.length > 0 && visibleSessions.length === 0 && !creating && (
        <p className="workout-log-empty">
          {selectedDay
            ? `No workout logged on ${selectedDay}.`
            : `No workouts logged in ${monthLabel(month)}.`}
        </p>
      )}

      {visibleSessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          entries={entries.filter((e) => e.sessionId === session.id).sort(byOldestFirst)}
          isOpen={session.id === openSessionId}
          exercises={exercises}
          fieldTypes={fieldTypes}
          historyFieldTypes={allFieldTypes}
          getLastEntry={getLastEntry}
          onToggle={() => handleToggle(session.id)}
          onUpdateSession={(date, name, durationSeconds) => handleUpdateSession(session.id, date, name, durationSeconds)}
          onFinishSession={() => handleFinishSession(session.id)}
          onDeleteSession={() => handleDeleteSession(session.id)}
          onAddEntry={(entry) => addEntry({ ...entry, sessionId: session.id, date: session.date })}
          onUpdateEntry={(entryId, entry) => handleUpdateEntry(entryId, entry)}
          onDeleteEntry={(entryId) => handleDeleteEntry(entryId)}
        />
      ))}
    </section>
  )
}
