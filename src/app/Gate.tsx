import { Navigate, Route, Routes } from 'react-router-dom'

import { useSession } from '../auth/useSession'
import { SignInScreen } from '../screens/signin/SignInScreen'
import { AppShell } from './AppShell'
import { HOME, SCREENS } from './screens'
import './Gate.css'

const SIGN_IN = '/sign-in'

/**
 * The gate: without an account no data is visible, with one the sign-in screen
 * is not.
 *
 * Every screen keeps its own URL, so a link to /calendar lands on /calendar
 * once you are in, not somewhere else.
 */
export function Gate() {
  const state = useSession()

  if (state.loading) {
    return (
      <div className="gate-waiting">
        <p>Loading…</p>
      </div>
    )
  }

  if (state.session === null) {
    return (
      <Routes>
        <Route path={SIGN_IN} element={<SignInScreen />} />
        <Route path="*" element={<Navigate to={SIGN_IN} replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell email={state.session.email} />}>
        {SCREENS.map((screen) => (
          <Route key={screen.path} path={screen.path} element={screen.element} />
        ))}
      </Route>
      {/* No URL without an exit, not even the sign-in one once you are in. */}
      <Route path="*" element={<Navigate to={HOME} replace />} />
    </Routes>
  )
}
