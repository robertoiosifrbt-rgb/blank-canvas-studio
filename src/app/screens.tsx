import type { ReactElement } from 'react'

import { CalendarScreen } from '../screens/calendar/CalendarScreen'
import { TodayScreen } from '../screens/today/TodayScreen'

export type Screen = {
  /** The screen's URL. Every screen has one, and can be opened directly. */
  path: string
  /** The label in the navigation bar. */
  label: string
  element: ReactElement
}

/**
 * A single list of screens. The routes and the navigation bar are generated
 * from it, so they can never end up saying different things.
 */
export const SCREENS: readonly Screen[] = [
  { path: '/today', label: 'Today', element: <TodayScreen /> },
  { path: '/calendar', label: 'Calendar', element: <CalendarScreen /> },
]

/** Where you land from `/` and from any URL that does not exist. */
export const HOME = '/today'
