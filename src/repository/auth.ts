// Autentificare: email și parolă. Datele vin după cont, pe orice telefon.
// Ecranele nu văd Supabase niciodată — cer și primesc de aici.

import { mesajulErorii } from './erori'
import { clientul } from './supabase'

export type Sesiune = {
  /** Ancora tuturor datelor utilizatorului: auth.uid() din bază. */
  utilizator: string
  email: string | null
}

function dinSesiuneaSupabase(
  sesiune: { user: { id: string; email?: string | undefined } } | null,
): Sesiune | null {
  if (sesiune === null) return null
  return { utilizator: sesiune.user.id, email: sesiune.user.email ?? null }
}

/** Sesiunea salvată pe dispozitivul ăsta, dacă există. */
export async function sesiuneaCurentă(): Promise<Sesiune | null> {
  const { data, error } = await clientul().auth.getSession()
  if (error !== null) throw new Error(mesajulErorii(error))
  return dinSesiuneaSupabase(data.session)
}

/** Anunță la fiecare intrare, ieșire sau reîmprospătare de token. */
export function laSchimbareaSesiunii(
  ascultător: (sesiune: Sesiune | null) => void,
): () => void {
  const { data } = clientul().auth.onAuthStateChange((_eveniment, sesiune) => {
    ascultător(dinSesiuneaSupabase(sesiune))
  })
  return () => {
    data.subscription.unsubscribe()
  }
}

export async function intră(email: string, parolă: string): Promise<void> {
  const { error } = await clientul().auth.signInWithPassword({
    email,
    password: parolă,
  })
  if (error !== null) throw new Error(mesajulErorii(error))
}

export type Înregistrare = {
  /** True când contul s-a creat, dar nu ești încă înăuntru. */
  cereConfirmareaEmailului: boolean
}

export async function înregistrează(
  email: string,
  parolă: string,
): Promise<Înregistrare> {
  const { data, error } = await clientul().auth.signUp({
    email,
    password: parolă,
  })
  if (error !== null) throw new Error(mesajulErorii(error))
  // Fără sesiune înapoi înseamnă că proiectul cere confirmare pe email.
  return { cereConfirmareaEmailului: data.session === null }
}

export async function ieși(): Promise<void> {
  const { error } = await clientul().auth.signOut()
  if (error !== null) throw new Error(mesajulErorii(error))
}
