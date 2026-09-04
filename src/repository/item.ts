// Forma unui item, și cele două reguli care nu au voie să fie scrise de două
// ori: ce zi e azi, și când se pune done_at.
//
// Numele câmpurilor sunt numele coloanelor din bază, nu traduceri. Un al doilea
// vocabular pentru același lucru e un loc în care se ascund greșeli, iar un
// patch trebuie să se potrivească pe coloane fără nicio conversie.

export type Stare = 'inbox' | 'active' | 'done'
export type Fel = 'task' | 'letter'

export type Item = {
  id: string
  owner: string
  kind: Fel | null
  state: Stare
  title: string
  /** Ce ai planificat. Dată, nu dată-și-oră. */
  due: string | null
  /** Ce s-a întâmplat: ziua în care ai bifat. */
  done_at: string | null
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Ce poate schimba un client.
 *
 * Lista e exact lista de coloane din `grant update` — id, owner, version,
 * created_at și updated_at nu apar, pentru că baza le refuză oricum. Aici
 * tipul le refuză mai devreme.
 */
export type Patch = Partial<
  Pick<Item, 'kind' | 'state' | 'title' | 'due' | 'done_at' | 'deleted_at'>
>

const STĂRI: readonly string[] = ['inbox', 'active', 'done']
const FELURI: readonly string[] = ['task', 'letter']

function text(rând: Record<string, unknown>, cheie: string): string {
  const valoare = rând[cheie]
  if (typeof valoare !== 'string' || valoare === '') {
    throw new Error(`Rând fără ${cheie}`)
  }
  return valoare
}

function textSauNimic(
  rând: Record<string, unknown>,
  cheie: string,
): string | null {
  const valoare = rând[cheie]
  if (valoare === null || valoare === undefined) return null
  if (typeof valoare !== 'string') throw new Error(`${cheie} nu e text`)
  return valoare
}

/**
 * Un rând venit de la server, verificat.
 *
 * Un răspuns parțial nu e niciodată tratat ca adevăr întreg: un rând căruia îi
 * lipsește un câmp nu intră în cache ca item pe jumătate.
 */
export function dinRând(rând: unknown): Item {
  if (typeof rând !== 'object' || rând === null) {
    throw new Error('Rândul nu e un obiect')
  }
  const brut = rând as Record<string, unknown>

  const state = text(brut, 'state')
  if (!STĂRI.includes(state)) throw new Error(`Stare necunoscută: ${state}`)

  const kind = textSauNimic(brut, 'kind')
  if (kind !== null && !FELURI.includes(kind)) {
    throw new Error(`Fel necunoscut: ${kind}`)
  }

  const version = brut['version']
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new Error('Rând fără version')
  }

  return {
    id: text(brut, 'id'),
    owner: text(brut, 'owner'),
    kind: kind as Fel | null,
    state: state as Stare,
    title: text(brut, 'title'),
    due: textSauNimic(brut, 'due'),
    done_at: textSauNimic(brut, 'done_at'),
    version,
    created_at: text(brut, 'created_at'),
    updated_at: text(brut, 'updated_at'),
    deleted_at: textSauNimic(brut, 'deleted_at'),
  }
}

/**
 * Ziua de azi, din ceasul dispozitivului.
 *
 * Nu din bază: `current_date` depinde de timezone-ul sesiunii PostgreSQL, iar
 * „azi" e ziua în care stă omul, nu serverul.
 */
export function aziLocal(acum: Date): string {
  const an = acum.getFullYear()
  const lună = String(acum.getMonth() + 1).padStart(2, '0')
  const zi = String(acum.getDate()).padStart(2, '0')
  return `${an}-${lună}-${zi}`
}

/**
 * Patch-ul, cu done_at pus de repository — singurul loc care decide.
 *
 * Când un item devine done, done_at ia ziua locală. Când iese din done, se
 * șterge. Un done_at trimis explicit în patch e respectat: foaia de item are
 * dreptul să corecteze ziua.
 */
export function cuFăcutLa(item: Item, patch: Patch, azi: string): Patch {
  if ('done_at' in patch) return patch

  const stareaNouă = patch.state ?? item.state
  if (stareaNouă === 'done' && item.state !== 'done') {
    return { ...patch, done_at: azi }
  }
  if (stareaNouă !== 'done' && item.state === 'done') {
    return { ...patch, done_at: null }
  }
  return patch
}
