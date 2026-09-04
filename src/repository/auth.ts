// Authentication: email and password. Your data follows the account, on any
// phone. Screens never see Supabase — they ask, and get answers, from here.

import { errorMessage } from './errors'
import { supabase } from './supabase'

export type Session = {
  /** The anchor of all of a user's data: auth.uid() in the database. */
  userId: string
  email: string | null
}

function fromSupabaseSession(
  session: { user: { id: string; email?: string | undefined } } | null,
): Session | null {
  if (session === null) return null
  return { userId: session.user.id, email: session.user.email ?? null }
}

/** The session stored on this device, if there is one. */
export async function currentSession(): Promise<Session | null> {
  const { data, error } = await supabase().auth.getSession()
  if (error !== null) throw new Error(errorMessage(error))
  return fromSupabaseSession(data.session)
}

/** Fires on every sign-in, sign-out and token refresh. */
export function onSessionChange(
  listener: (session: Session | null) => void,
): () => void {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    listener(fromSupabaseSession(session))
  })
  return () => {
    data.subscription.unsubscribe()
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error !== null) throw new Error(errorMessage(error))
}

export type SignUpResult = {
  /** True when the account was created but you are not inside yet. */
  needsEmailConfirmation: boolean
}

export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase().auth.signUp({ email, password })
  if (error !== null) throw new Error(errorMessage(error))
  // No session back means the project requires email confirmation.
  return { needsEmailConfirmation: data.session === null }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut()
  if (error !== null) throw new Error(errorMessage(error))
}
