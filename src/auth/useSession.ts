import { useEffect, useState } from 'react'

import { currentSession, onSessionChange } from '../repository/auth'
import type { Session } from '../repository/auth'

export type SessionState =
  | { loading: true }
  | { loading: false; session: Session | null }

/**
 * The current session, watched.
 *
 * While it is loading it does not say "you are not signed in" — otherwise a
 * signed-in user would see the sign-in screen for a blink on every open.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true })
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    let stopListening = () => {}

    // Everything that can fail — including a missing configuration, which
    // throws while building the client — goes through this promise. Thrown
    // from the effect body it would not be caught by the error boundary.
    const start = async () => {
      stopListening = onSessionChange((session) => {
        if (active) setState({ loading: false, session })
      })
      const session = await currentSession()
      if (active) setState({ loading: false, session })
    }

    void start().catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason : new Error(String(reason)))
      }
    })

    return () => {
      active = false
      stopListening()
    }
  }, [])

  // Thrown during render, so the error boundary catches it and it is seen.
  if (error !== null) throw error
  return state
}
