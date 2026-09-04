// Singurul loc care vorbește efectiv cu tabelul items.
//
// Restul repository-ului lucrează pe interfețele Sursă și Scriitor, ca logica
// de sincronizare și de scriere să poată fi verificată fără rețea.

import type { Patch } from './item'
import type { Sursă } from './sincronizare'
import type { Scriitor } from './scriere'
import { clientul } from './supabase'

const TABEL = 'items'
const TOATE = '*'

function cade(operație: string, eroare: { message: string }): never {
  throw new Error(`${operație}: ${eroare.message}`)
}

/**
 * Rândurile utilizatorului, paginate.
 *
 * Aduce și rândurile cu deleted_at — de-aia le ținem: fără ele, un item șters
 * pe telefon ar rămâne pe veci în cache-ul laptopului.
 */
export function sursaSupabase(): Sursă {
  return {
    async pagină({ deLa, pânăLa, dinCursor }) {
      let interogare = clientul()
        .from(TABEL)
        .select(TOATE)
        // Ordine stabilă, altfel paginarea poate sări sau repeta rânduri.
        .order('id', { ascending: true })
        .range(deLa, pânăLa)

      if (dinCursor !== null) {
        // Inclusiv, anume: upsert-ul e idempotent, deci un rând adus de două
        // ori nu strică nimic, și așa nu se pierde o a doua modificare cu
        // același updated_at.
        interogare = interogare.gte('updated_at', dinCursor)
      }

      // Fără tipuri generate din schemă, PostgREST întoarce `any`. Se trece
      // anume prin `unknown`: singurul lucru care validează un rând e dinRând.
      const răspuns = await interogare
      if (răspuns.error !== null) cade('Aducerea rândurilor', răspuns.error)
      return răspuns.data as unknown[]
    },
  }
}

/**
 * Scrierile, pe rând.
 *
 * `owner` e pus și în condiții, deși politica de RLS îl impune oricum: dacă
 * politica ar fi vreodată greșită, condiția rămâne.
 */
export function scriitorulSupabase(owner: string): Scriitor {
  return {
    async inserează(valori: { title: string }) {
      const răspuns = await clientul()
        .from(TABEL)
        .insert(valori)
        .select(TOATE)
        .single()
      if (răspuns.error !== null) cade('Scrierea rândului nou', răspuns.error)
      return răspuns.data as unknown
    },

    async actualizează(id: string, versiune: number, patch: Patch) {
      // update items set <patch>
      // where id = :id and owner = auth.uid() and version = :version
      const răspuns = await clientul()
        .from(TABEL)
        .update(patch)
        .eq('id', id)
        .eq('owner', owner)
        .eq('version', versiune)
        .select(TOATE)
      if (răspuns.error !== null) cade('Modificarea rândului', răspuns.error)
      return răspuns.data as unknown[]
    },

    async citește(id: string) {
      const răspuns = await clientul()
        .from(TABEL)
        .select(TOATE)
        .eq('id', id)
        .eq('owner', owner)
        .maybeSingle()
      if (răspuns.error !== null) cade('Recitirea rândului', răspuns.error)
      return răspuns.data as unknown
    },
  }
}
