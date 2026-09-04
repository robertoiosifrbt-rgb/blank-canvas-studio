import { createClient, type Session } from '@supabase/supabase-js'
import { SETTINGS_ID, TABLES, rowForDb, type Change, type Rows, type Table } from './dbRows'

/**
 * Legătura cu baza de date: rânduri, nu un text.
 *
 * Fiecare rând știe al cui e, iar baza refuză singură rândurile altcuiva —
 * de aia cheia din codul site-ului poate fi publică. Contul e cel care
 * deschide ușa, nu un token purtat dintr-un telefon în altul.
 */

const URL = 'https://xmhvkgoxhoiuiigimied.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_0Qj9Bhx7hFvcRJ2AI_8R8g_WFw2uGwy'

/** Câte rânduri într-o cerere. Peste atât, cererea devine prea mare. */
const CHUNK = 400

export const db = createClient(URL, PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export async function currentSession(): Promise<Session | null> {
  const { data } = await db.auth.getSession()
  return data.session
}

export function onAuthChange(handler: (session: Session | null) => void): () => void {
  const { data } = db.auth.onAuthStateChange((_event, session) => handler(session))
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await db.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message)
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await db.auth.signUp({ email: email.trim(), password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  await db.auth.signOut()
}

const chunks = <T>(items: T[]): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK))
  return out
}

/**
 * Tot ce e al tău, o dată, la pornire.
 *
 * Se cer toate tabelele deodată: sunt cereri independente, iar una câte una
 * ar însemna douăzeci și patru de drumuri dus-întors pe rețeaua telefonului.
 */
export async function loadRows(): Promise<Rows> {
  const results = await Promise.all(TABLES.map(async table => {
    const { data, error } = await db.from(table).select('*')
    if (error) throw new Error(`${table}: ${error.message}`)
    return [table, data ?? []] as const
  }))

  const rows = {} as Rows
  for (const [table, list] of results) {
    rows[table] = table === 'settings'
      ? Object.fromEntries(list.map(row => [SETTINGS_ID, { ...strip(row), id: SETTINGS_ID }]))
      : Object.fromEntries(list.map(row => [String(row.id), strip(row)]))
  }
  return rows
}

/** `owner` e al bazei, nu al aplicației: nu are ce căuta în comparații. */
function strip(row: Record<string, unknown>): Record<string, unknown> {
  const { owner: _owner, ...rest } = row
  return rest
}

/**
 * Scrie ce s-a schimbat.
 *
 * Întâi scrierile, în ordinea părinte-înainte-de-copil; apoi ștergerile, în
 * ordine inversă. Altfel un copil ar ajunge înaintea părintelui lui, sau un
 * părinte ar pleca lăsând copiii în urmă, iar baza ar refuza — pe drept.
 */
export async function applyChanges(changes: Change[], owner: string): Promise<void> {
  const at = (table: Table): Change | undefined => changes.find(c => c.table === table)

  for (const table of TABLES) {
    const upserts = at(table)?.upserts ?? []
    for (const batch of chunks(upserts)) {
      const { error } = await db.from(table).upsert(batch.map(row => ({ ...rowForDb(table, row), owner })))
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }

  for (const table of [...TABLES].reverse()) {
    const ids = at(table)?.deletes ?? []
    /* Rândul setărilor nu se șterge niciodată: e unul singur și există mereu. */
    if (table === 'settings') continue
    for (const batch of chunks(ids)) {
      const { error } = await db.from(table).delete().eq('owner', owner).in('id', batch)
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }
}
