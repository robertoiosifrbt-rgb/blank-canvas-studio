import { emptyOsData, type OsData } from './types'

/**
 * Aducerea datelor dintr-un fișier exportat, sau pregătit din afară.
 *
 * Adaugă și înlocuiește după id; nu șterge niciodată. Un import care ar putea
 * goli aplicația ar fi o unealtă de care ți-e frică — și oricum ce lipsește
 * dintr-un fișier înseamnă „nu era în el", nu „șterge".
 */

const BAGS = ['modules', 'goals', 'tasks', 'habits', 'notes', 'debts', 'orgs',
  'vehicles', 'workdays', 'docs'] as const

export interface ImportResult {
  data: OsData
  /** Câte intrări au venit din fișier, pe categorii, ca să vezi ce a intrat. */
  added: Record<string, number>
  error: string | null
}

const isBag = (value: unknown): value is Record<string, { id?: unknown }> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function importInto(current: OsData, incoming: unknown): ImportResult {
  if (!isBag(incoming)) {
    return { data: current, added: {}, error: 'Fișierul nu conține date Roberto OS.' }
  }

  const next: OsData = { ...emptyOsData(), ...structuredClone(current) }
  const added: Record<string, number> = {}
  const raw = incoming as unknown as Record<string, unknown>

  for (const bag of BAGS) {
    const items = raw[bag]
    if (!isBag(items)) continue
    let count = 0
    for (const [id, item] of Object.entries(items)) {
      if (!item || typeof item !== 'object') continue
      /* Id-ul din cheie e cel care contează: un id scris altfel înăuntru ar
         face intrarea de negăsit după ce e salvată. */
      ;(next[bag] as Record<string, unknown>)[id] = { ...item, id }
      count += 1
    }
    if (count) added[bag] = count
  }

  /* Lunile de finanțe se contopesc lună cu lună, altfel un fișier cu o
     singură lună ar înlocui tot anul. */
  const finance = raw.finance
  if (isBag(finance)) {
    let count = 0
    for (const [month, value] of Object.entries(finance)) {
      const items = (value as { items?: unknown })?.items
      if (!Array.isArray(items)) continue
      const have = next.finance[month]?.items ?? []
      const ids = new Set(have.map(item => item.id))
      const fresh = items.filter(item => !ids.has((item as { id?: string }).id ?? ''))
      next.finance[month] = { items: [...have, ...fresh] as typeof have }
      count += fresh.length
    }
    if (count) added.finance = count
  }

  if (Object.keys(added).length === 0) {
    return { data: current, added: {}, error: 'Fișierul nu conținea nimic de adăugat.' }
  }
  return { data: next, added, error: null }
}

/** „3 documente, 1 datorie" — pentru mesajul de după import. */
const NAMES: Record<string, [string, string]> = {
  modules: ['modul', 'module'],
  goals: ['obiectiv', 'obiective'],
  tasks: ['task', 'task-uri'],
  habits: ['obicei', 'obiceiuri'],
  notes: ['însemnare', 'însemnări'],
  debts: ['datorie', 'datorii'],
  orgs: ['organizație', 'organizații'],
  vehicles: ['mașină', 'mașini'],
  workdays: ['tură', 'ture'],
  docs: ['document', 'documente'],
  finance: ['mișcare', 'mișcări'],
}

export const describeImport = (added: Record<string, number>): string =>
  Object.entries(added)
    .map(([bag, count]) => `${count} ${NAMES[bag]?.[count === 1 ? 0 : 1] ?? bag}`)
    .join(', ')
