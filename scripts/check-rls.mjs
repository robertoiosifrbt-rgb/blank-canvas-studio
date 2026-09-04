#!/usr/bin/env node
// Testul de RLS, pe o bază Supabase locală și efemeră.
//
// Nu atinge niciodată baza de producție: cere DATABASE_URL explicit și cade
// dacă nu-l primește. CI îl pornește după `supabase start`.

import pg from 'pg'

import { A, B, CAZURI, contextul } from './lib/rls.mjs'

const URL_BAZĂ = process.env.DATABASE_URL
if (!URL_BAZĂ) {
  console.error(
    'Lipsește DATABASE_URL. Testul de RLS rulează numai pe o bază locală:\n' +
      '  supabase start\n' +
      '  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run check:rls',
  )
  process.exit(1)
}

// Fiecare grup trebuie să aibă cazuri. Un test de RLS cu zero negative sau
// zero pozitive e o verificare verde care nu verifică nimic.
const GRUPURI_CERUTE = ['negativ', 'pozitiv', 'constrângere']

const client = new pg.Client({ connectionString: URL_BAZĂ })
const căzute = []

await client.connect()

try {
  // Doi utilizatori, semănați ca administrator. Cazurile rulează fiecare în
  // propria tranzacție și o dau înapoi, deci rândurile nu se scurg între ele.
  for (const [uid, email] of [
    [A, 'a@verificare.local'],
    [B, 'b@verificare.local'],
  ]) {
    await client.query(
      'insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing',
      [uid, email],
    )
  }

  for (const grup of GRUPURI_CERUTE) {
    const dinGrup = CAZURI.filter((caz) => caz.grup === grup)
    if (dinGrup.length === 0) {
      căzute.push({ nume: `grupul „${grup}"`, motiv: 'nu are niciun caz' })
      continue
    }
    console.log(`\n  ${grup}:`)
    for (const caz of dinGrup) {
      // Fiecare caz stă în propria tranzacție, dată înapoi la final: nici
      // pregătirea lui nu se comite, deci cazurile nu se pot influența.
      await client.query('begin')
      try {
        await caz.rulează(contextul(client))
        console.log(`    ✓ ${caz.nume}`)
      } catch (eroare) {
        console.log(`    ✗ ${caz.nume}`)
        căzute.push({ nume: caz.nume, motiv: eroare.message })
      } finally {
        await client.query('rollback')
      }
    }
  }
} finally {
  // Baza e efemeră, dar verificatorul nu lasă totuși rânduri după el.
  try {
    await client.query('delete from public.items where owner in ($1, $2)', [A, B])
    await client.query('delete from auth.users where id in ($1, $2)', [A, B])
  } catch (eroare) {
    căzute.push({ nume: 'curățenia de la final', motiv: eroare.message })
  }
  await client.end()
}

if (căzute.length === 0) {
  console.log(`\nRLS în regulă: ${CAZURI.length} cazuri.`)
  process.exit(0)
}

console.error(`\nRLS: ${căzute.length} cazuri căzute din ${CAZURI.length}\n`)
for (const cădere of căzute) {
  console.error(`  ${cădere.nume}: ${cădere.motiv}`)
}
process.exit(1)
