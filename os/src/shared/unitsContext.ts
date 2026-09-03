import { createContext, useContext } from 'react'
import type { UnitSystem } from './units'

/*
 * Contextul și cititorul lui stau separat de `UnitsProvider.tsx` pentru că un
 * fișier care exportă și o componentă, și altceva, rupe hot-reload-ul din Vite
 * (regula `react(only-export-components)`).
 */

export interface UnitsContextValue {
  system: UnitSystem
  /** `false` când `localStorage` a refuzat scrierea — setarea rămâne cea veche. */
  setSystem: (system: UnitSystem) => boolean
}

export const UnitsContext = createContext<UnitsContextValue | null>(null)

/**
 * Sistemul de unități ales în Settings.
 *
 * Fără provider, răspunsul e „metric" — exact ce vede o instalare nouă. Un
 * ecran montat singur (într-un test, sau într-un viitor ecran izolat) arată
 * atunci unitățile implicite în loc să crape.
 */
export function useUnits(): UnitsContextValue {
  return useContext(UnitsContext) ?? { system: 'metric', setSystem: () => false }
}
