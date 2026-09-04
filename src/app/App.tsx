import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from './ErrorBoundary'
import { AppShell } from './AppShell'
import { ACASĂ, ECRANE } from './screens'

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {ECRANE.map((ecran) => (
              <Route key={ecran.cale} path={ecran.cale} element={ecran.element} />
            ))}
          </Route>
          {/* Niciun URL fără ieșire: orice cale necunoscută duce înapoi în Azi. */}
          <Route path="*" element={<Navigate to={ACASĂ} replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
