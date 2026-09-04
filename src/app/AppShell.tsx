import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { ieși } from '../repository/auth'
import { ECRANE } from './screens'
import './AppShell.css'

type Props = {
  /** Contul în care ești. Fără el nu s-ar ști ale cui sunt datele de pe ecran. */
  email: string | null
}

export function AppShell({ email }: Props) {
  const locație = useLocation()
  const curent = ECRANE.find((ecran) => ecran.cale === locație.pathname)
  const [eroare, setEroare] = useState<string | null>(null)

  function ieșire() {
    setEroare(null)
    void ieși().catch((motiv: unknown) => {
      setEroare(motiv instanceof Error ? motiv.message : String(motiv))
    })
  }

  return (
    <div className="shell">
      <header className="shell-cap">
        <div className="shell-cap-rând">
          <h1 className="shell-titlu">{curent?.etichetă ?? 'Life Control Centre'}</h1>
          <button className="shell-ieși" type="button" onClick={ieșire}>
            Ieși
          </button>
        </div>
        {email !== null && <p className="shell-cont">{email}</p>}
        {eroare !== null && (
          <p className="shell-eroare" role="alert">
            {eroare}
          </p>
        )}
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
