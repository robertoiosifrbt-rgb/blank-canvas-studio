import { useMemo, type ReactNode } from 'react'
import { usePersistedState } from './usePersistedState'
import { UNIT_SYSTEMS, type UnitSystem } from './units'
import { UnitsContext } from './unitsContext'

const STORAGE_KEY = 'gym-app:units'

/*
 * Preferința nu e „date": dacă valoarea salvată e ceva ce nu recunoaștem,
 * revenim la metric fără să raportăm nimic pierdut. Restul cheilor din
 * `localStorage` fac copie de siguranță și anunță utilizatorul pentru că acolo
 * s-ar pierde istoric; aici s-ar pierde un cuvânt pe care îl poate pune la loc
 * dintr-o singură apăsare.
 */
function recover(parsed: unknown): { value: UnitSystem; dropped: number } {
  const value = UNIT_SYSTEMS.includes(parsed as UnitSystem) ? (parsed as UnitSystem) : 'metric'
  return { value, dropped: 0 }
}

/**
 * Sistemul de unități, ținut într-un singur loc.
 *
 * Un `usePersistedState` per ecran ar fi dat fiecărui ecran propria copie:
 * apeși „Imperial" în Settings, treci la Body și încă scrie kg, pentru că
 * evenimentul `storage` al browserului se trimite doar **între file**, nu în
 * fila care a scris. De aici context, nu un hook liber.
 */
export function UnitsProvider({ children }: { children: ReactNode }) {
  const { value, update } = usePersistedState<UnitSystem>(STORAGE_KEY, 'metric', recover)
  const context = useMemo(() => ({ system: value, setSystem: update }), [value, update])
  return <UnitsContext.Provider value={context}>{children}</UnitsContext.Provider>
}
