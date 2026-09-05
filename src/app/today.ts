import { useEffect, useState } from 'react'

import { localToday } from '../repository/items'

/**
 * Milliseconds from now until the next local midnight.
 *
 * Local, not UTC: the day that has to change is the one on the wall behind
 * you. Never zero — at midnight exactly, the next one is a whole day away.
 */
export function untilMidnight(now: Date): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

/**
 * Today, kept true while the app is open.
 *
 * Read once per render, it would stay on yesterday: you leave the app in the
 * background overnight and come back to a Today screen showing the day before,
 * with nothing saying so. "Tell me what to do now" is the reason this system
 * exists, and a silent day-behind is exactly that failing.
 *
 * Two things move it. A timer to the next midnight, for the app left open. And
 * coming back to the foreground, for the phone that put the timer to sleep —
 * on a phone that is the case that actually happens.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localToday(new Date()))

  useEffect(() => {
    let timer = 0

    const atMidnight = () => {
      setToday(localToday(new Date()))
      // Measured again from now, not by adding a day: a timer that fired late
      // must not push the next one further out.
      timer = window.setTimeout(atMidnight, untilMidnight(new Date()))
    }

    timer = window.setTimeout(atMidnight, untilMidnight(new Date()))

    const onVisible = () => {
      if (!document.hidden) setToday(localToday(new Date()))
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}
