import { Navigate, Route, Routes } from 'react-router-dom'

import { useSesiune } from '../auth/useSesiune'
import { IntrareScreen } from '../screens/intrare/IntrareScreen'
import { AppShell } from './AppShell'
import { ACASĂ, ECRANE } from './screens'
import './Poarta.css'

const INTRARE = '/intrare'

/**
 * Poarta: fără cont nu se vede nicio dată, cu cont nu se mai vede intrarea.
 *
 * Fiecare ecran își păstrează URL-ul, deci un link către /calendar duce la
 * /calendar după ce intri, nu în altă parte.
 */
export function Poarta() {
  const stare = useSesiune()

  if (stare.seÎncarcă) {
    return (
      <div className="poarta-așteptare">
        <p>Se încarcă…</p>
      </div>
    )
  }

  if (stare.sesiune === null) {
    return (
      <Routes>
        <Route path={INTRARE} element={<IntrareScreen />} />
        <Route path="*" element={<Navigate to={INTRARE} replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell email={stare.sesiune.email} />}>
        {ECRANE.map((ecran) => (
          <Route key={ecran.cale} path={ecran.cale} element={ecran.element} />
        ))}
      </Route>
      {/* Niciun URL fără ieșire, nici cel de intrare când ești deja înăuntru. */}
      <Route path="*" element={<Navigate to={ACASĂ} replace />} />
    </Routes>
  )
}
