import { useWorkoutLog } from '../features/workout-log/useWorkoutLog'
import { useWorkoutSessions } from '../features/workout-log/useWorkoutSessions'
import { formatDuration, sessionDurationSeconds, sessionVolume } from '../features/workout-log/sessionStats'
import { todayLocal } from '../shared/localDate'
import { formatVolume, toDisplay } from '../shared/units'
import { useUnits } from '../shared/unitsContext'
import { useProfile } from '../features/settings/useProfile'
import './HomePage.css'

interface HomePageProps {
  /** Opens the full-screen runner: with a session id to resume, without one to pick exercises. */
  onStartWorkout: (sessionId?: string) => void
  onOpenWorkoutLog: () => void
  onOpenExercises: () => void
  onOpenBody: () => void
  onOpenPhotos: () => void
}

function Icon({ name }: { name: 'bell' | 'workout' | 'list' | 'body' | 'camera' | 'bag' | 'check' | 'plus' | 'play' }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'play') return <svg {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z"/></svg>
  if (name === 'bell') return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
  if (name === 'workout') return <svg {...p}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
  if (name === 'list') return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>
  if (name === 'body') return <svg {...p}><circle cx="12" cy="5.5" r="2.5"/><path d="M9.5 21v-6l-2-3 2-2h5l2 2-2 3v6M9.5 12h5"/></svg>
  if (name === 'camera') return <svg {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3"/></svg>
  if (name === 'bag') return <svg {...p}><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
  if (name === 'check') return <svg {...p}><path d="m6 12 4 4 8-8"/></svg>
  return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
}

function formatHomeDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

function getMonday(date = new Date()) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

export function HomePage({ onStartWorkout, onOpenWorkoutLog, onOpenExercises, onOpenBody, onOpenPhotos }: HomePageProps) {
  const { sessions } = useWorkoutSessions()
  const { entries } = useWorkoutLog()
  const { system } = useUnits()
  const { profile } = useProfile()
  const monday = getMonday()
  const today = todayLocal()
  const weeklySessions = sessions.filter((session) => new Date(`${session.date}T12:00:00`) >= monday)
  const weeklyWorkouts = Math.min(weeklySessions.length, 5)
  const weeklyPercent = Math.round((weeklyWorkouts / 5) * 100)
  const weeklyVolume = weeklySessions.reduce((sum, session) => sum + sessionVolume(entries, session.id), 0)
  const weeklyDuration = weeklySessions.filter((s) => s.endedAt).reduce((sum, session) => sum + sessionDurationSeconds(session), 0)
  const todaySession = sessions.find((session) => session.date === today && !session.endedAt) ?? sessions.find((session) => session.date === today)
  const todayEntries = todaySession ? entries.filter((entry) => entry.sessionId === todaySession.id) : []
  const recentSessions = sessions.slice(0, 3)

  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (weeklyPercent / 100) * circumference

  // Salutul era „Hey Roberto", scris în cod. Numele vine acum din profil, iar
  // cât timp nu e completat, salutul nu inventează unul.
  const greeting = profile.name.trim() || 'there'

  // Volumul săptămânii se scurtează la mii („7.7k kg"): pe dala asta încap trei
  // cifre, nu șase. Conversia se face înainte de împărțire — altfel „k"-ul ar
  // rămâne mii de kilograme cu eticheta „lb" lângă.
  const weeklyVolumeDisplay = toDisplay(weeklyVolume, 'kg', system)
  const weeklyVolumeLabel = weeklyVolume ? `${(weeklyVolumeDisplay.value / 1000).toFixed(1)}k ${weeklyVolumeDisplay.unit}` : '—'

  return <section className="target-home">
    <header className="target-home-header"><div><h1><span className="hello-wave" aria-hidden="true">👋</span> Hey {greeting}</h1><p>Ready to crush your goals?</p></div><button type="button" className="icon-button" aria-label="Notifications"><Icon name="bell"/></button></header>

    <section className="target-card weekly-progress-card" aria-label="Weekly Progress">
      <h2>Weekly Progress</h2>
      <div className="weekly-progress-layout"><div className="progress-ring"><svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" className="progress-ring-bg"/><circle cx="60" cy="60" r="45" className="progress-ring-fill" style={{strokeDashoffset}} strokeDasharray={circumference}/></svg><div className="progress-ring-text"><strong>{weeklyPercent}%</strong></div></div><dl className="weekly-metrics"><div><dt>Workouts</dt><dd>{weeklyWorkouts} / 5</dd></div><div><dt>Volume</dt><dd>{weeklyVolumeLabel}</dd></div><div><dt>Duration</dt><dd>{formatDuration(weeklyDuration)}</dd></div></dl></div>
    </section>

    <section className="target-card today-workout-card"><h2>Today's Workout</h2><strong className="today-workout-name">{todaySession?.name || (todaySession ? 'Workout' : 'No workout started')}</strong><span className="today-workout-meta">{todaySession ? `${todayEntries.length} ${todayEntries.length === 1 ? 'exercise' : 'exercises'}${todaySession.endedAt ? ` · ${formatDuration(sessionDurationSeconds(todaySession))}` : ' · in progress'}` : 'Start a session when you are ready'}</span><button type="button" className="coral-action" onClick={() => onStartWorkout(todaySession && !todaySession.endedAt ? todaySession.id : undefined)}><span className="button-icon"><Icon name="play"/></span>{todaySession && !todaySession.endedAt ? 'Continue Workout' : 'Start Workout'}</button></section>

    <section className="home-block quick-actions-block"><h2>Quick Actions</h2><div className="target-quick-grid"><button type="button" onClick={onOpenWorkoutLog}><span><Icon name="workout"/></span><strong>Log Workout</strong></button><button type="button" onClick={onOpenExercises}><span><Icon name="list"/></span><strong>Exercises</strong></button><button type="button" onClick={onOpenBody}><span><Icon name="body"/></span><strong>Body Stats</strong></button><button type="button" onClick={onOpenPhotos}><span><Icon name="camera"/></span><strong>Progress Photos</strong></button></div></section>

    <section className="home-block recent-workouts-block"><div className="target-section-title"><h2>Recent Workouts</h2><button type="button" onClick={onOpenWorkoutLog}>View all</button></div><div className="recent-workout-list">{recentSessions.length ? recentSessions.map((session) => { const volume = sessionVolume(entries, session.id); const duration = sessionDurationSeconds(session); return <button type="button" className="recent-workout-row" onClick={onOpenWorkoutLog} key={session.id}><span className="recent-workout-icon"><Icon name="bag"/></span><span><strong>{session.name || 'Workout'}</strong><small>{formatHomeDate(session.date)}{duration ? ` · ${formatDuration(duration)}` : ''}</small></span>{volume > 0 && <span className="recent-workout-volume">{formatVolume(volume, system)}</span>}{session.endedAt && <span className="recent-workout-done"><Icon name="check"/></span>}</button> }) : <button type="button" className="recent-workout-row" onClick={() => onStartWorkout()}><span className="recent-workout-icon"><Icon name="plus"/></span><span><strong>No workouts yet</strong><small>Start your first session</small></span></button>}</div></section>
  </section>
}
