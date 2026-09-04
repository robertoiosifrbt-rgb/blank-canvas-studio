import type { ReactElement } from 'react'

import { AziScreen } from '../screens/azi/AziScreen'
import { CalendarScreen } from '../screens/calendar/CalendarScreen'

export type Ecran = {
  /** URL-ul ecranului. Fiecare ecran are unul, și se poate intra direct pe el. */
  cale: string
  /** Eticheta din bara de navigație. */
  etichetă: string
  element: ReactElement
}

/**
 * O singură listă de ecrane. Rutele și bara de navigație se generează din ea,
 * ca să nu poată ajunge niciodată să spună lucruri diferite.
 */
export const ECRANE: readonly Ecran[] = [
  { cale: '/azi', etichetă: 'Azi', element: <AziScreen /> },
  { cale: '/calendar', etichetă: 'Calendar', element: <CalendarScreen /> },
]

/** Unde ajungi de pe `/` și de pe orice URL care nu există. */
export const ACASĂ = '/azi'
