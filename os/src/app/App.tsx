import { useState } from 'react'
import { BodyPage } from '../features/body'
import { ExercisesPage } from '../features/exercises'
import { WorkoutLogPage } from '../features/workout-log'
import { ProgressPhotosPage } from '../features/progress-photos'
import { SettingsPage } from '../features/settings'
import { WorkoutRunnerScreen } from '../features/workout-runner'
import { HomePage } from './HomePage'
import { Nav } from './Nav'
import { SubNav } from './SubNav'
import { ErrorBoundary } from './ErrorBoundary'
import { UpdateBanner } from './UpdateBanner'
import { useVersionCheck } from './useVersionCheck'
import { UnitsProvider } from '../shared/UnitsProvider'

export type Page = 'home' | 'body' | 'workout' | 'progress' | 'settings'
type WorkoutSubPage = 'log' | 'exercises'

/** `null` when the runner is closed; `sessionId` is empty while picking exercises for a new one. */
type RunnerState = { sessionId: string } | null

function AppScreens() {
  const [page, setPage] = useState<Page>('home')
  const [workoutSubPage, setWorkoutSubPage] = useState<WorkoutSubPage>('log')
  const [runner, setRunner] = useState<RunnerState>(null)
  const updateAvailable = useVersionCheck()

  const workoutTabs = (
    <SubNav
      tabs={[
        { key: 'log', label: 'Log' },
        { key: 'exercises', label: 'Exercises' },
      ]}
      current={workoutSubPage}
      onChange={setWorkoutSubPage}
    />
  )

  function openWorkoutLog() {
    setPage('workout')
    setWorkoutSubPage('log')
  }

  // The runner takes over the whole screen — no app header and no bottom nav,
  // the way the session screen is meant to be used mid-set. Closing it
  // remounts the pages underneath, so they re-read what the runner saved.
  if (runner) {
    return (
      <ErrorBoundary>
        <WorkoutRunnerScreen
          sessionId={runner.sessionId || undefined}
          onExit={() => setRunner(null)}
        />
      </ErrorBoundary>
    )
  }

  return (
    <div className="app-shell">
      {/* No global title bar: every screen in the visual target carries its own
          header, so the app name is not repeated above them. See PageHeader. */}
      {updateAvailable && <UpdateBanner />}

      <main className="app-content">
        <ErrorBoundary>
          {page === 'home' && (
            <HomePage
              onStartWorkout={(sessionId) => setRunner({ sessionId: sessionId ?? '' })}
              onOpenWorkoutLog={openWorkoutLog}
              onOpenExercises={() => {
                setPage('workout')
                setWorkoutSubPage('exercises')
              }}
              onOpenBody={() => setPage('body')}
              onOpenPhotos={() => setPage('progress')}
            />
          )}

          {page === 'body' && <BodyPage />}

          {page === 'workout' && (
            /*
             * Tab-urile intră **în** ecran, sub titlul lui. Randate aici, ele
             * apăreau deasupra lui „Workout Log" — adică o a doua bară care
             * traversa toate ecranele tab-ului, exact forma scoasă în etapa 1.
             * Body își ține tab-urile sub titlu de la bun început.
             */
            <>
              {workoutSubPage === 'log' && <WorkoutLogPage tabs={workoutTabs} />}
              {workoutSubPage === 'exercises' && <ExercisesPage tabs={workoutTabs} />}
            </>
          )}

          {page === 'progress' && <ProgressPhotosPage />}

          {page === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </main>

      <Nav current={page} onNavigate={setPage} />
    </div>
  )
}

/*
 * Sistemul de unități e citit de patru ecrane și schimbat dintr-unul singur
 * (Settings), deci stă deasupra tuturor. Un hook propriu per ecran ar fi dat
 * fiecăruia o copie: schimbi în Settings, treci la Body, și acolo scrie încă
 * kilograme până la o reîncărcare.
 */
function App() {
  return (
    <UnitsProvider>
      <AppScreens />
    </UnitsProvider>
  )
}

export default App
