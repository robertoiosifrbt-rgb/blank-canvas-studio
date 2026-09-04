import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { signOut } from '../repository/auth'
import { SCREENS } from './screens'
import './AppShell.css'

type Props = {
  /** The account you are in. Without it, you cannot tell whose data is shown. */
  email: string | null
}

export function AppShell({ email }: Props) {
  const location = useLocation()
  const current = SCREENS.find((screen) => screen.path === location.pathname)
  const [error, setError] = useState<string | null>(null)

  function leave() {
    setError(null)
    void signOut().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-row">
          <h1 className="shell-title">{current?.label ?? 'Life Control Centre'}</h1>
          <button className="shell-signout" type="button" onClick={leave}>
            Sign out
          </button>
        </div>
        {email !== null && <p className="shell-account">{email}</p>}
        {error !== null && (
          <p className="shell-error" role="alert">
            {error}
          </p>
        )}
      </header>

      <main className="shell-body">
        <Outlet />
      </main>

      <nav className="shell-nav" aria-label="Screens">
        {SCREENS.map((screen) => (
          <NavLink key={screen.path} to={screen.path} className="shell-nav-button">
            {screen.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
