import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { ECRANE } from './screens'
import './AppShell.css'

export function AppShell() {
  const locație = useLocation()
  const curent = ECRANE.find((ecran) => ecran.cale === locație.pathname)

  return (
    <div className="shell">
      <header className="shell-cap">
        <h1 className="shell-titlu">{curent?.etichetă ?? 'Life Control Centre'}</h1>
      </header>

      <main className="shell-corp">
        <Outlet />
      </main>

      <nav className="shell-nav" aria-label="Ecrane">
        {ECRANE.map((ecran) => (
          <NavLink key={ecran.cale} to={ecran.cale} className="shell-nav-buton">
            {ecran.etichetă}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
