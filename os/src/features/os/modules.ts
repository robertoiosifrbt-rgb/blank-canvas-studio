import type { OsData, OsModule } from './types'

/** Modulele incluse. Cele făcute de utilizator li se adaugă. */
export const BUILTIN: OsModule[] = [
  { id: 'azi', name: 'Azi', kind: 'dashboard' },
  { id: 'goals', name: 'Goals', kind: 'goals' },
  { id: 'calendar', name: 'Calendar', kind: 'calendar' },
  { id: 'finante', name: 'Finanțe', kind: 'finance' },
  { id: 'datorii', name: 'Datorii', kind: 'debts' },
  { id: 'taskuri', name: 'Task-uri', kind: 'tasks' },
  { id: 'obiceiuri', name: 'Obiceiuri', kind: 'habits' },
  { id: 'jurnal', name: 'Jurnal', kind: 'notes' },
  { id: 'documente', name: 'Documente', kind: 'docs' },
  { id: 'business', name: 'Business', kind: 'hub' },
  { id: 'pfa', name: 'Self-employed', kind: 'hub', parent: 'business' },
  { id: 'livrari', name: 'Food delivery', kind: 'delivery', parent: 'pfa' },
  { id: 'health', name: 'Health', kind: 'hub' },
  { id: 'gym', name: 'Gym', kind: 'gym', parent: 'health' },
]

export const allModules = (data: OsData): OsModule[] =>
  BUILTIN.concat(
    Object.values(data.modules).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
  )

export const moduleById = (data: OsData, id: string): OsModule | undefined =>
  allModules(data).find(m => m.id === id)

export const childrenOf = (data: OsData, parent: string): OsModule[] =>
  allModules(data).filter(m => (m.parent ?? '') === parent)

export interface TreeNode extends OsModule { depth: number }

/** Lista aplatizată în ordinea arborelui. `seen` oprește o buclă din date stricate. */
export function moduleTree(data: OsData, parent = '', depth = 0,
  out: TreeNode[] = [], seen = new Set<string>()): TreeNode[] {
  for (const m of childrenOf(data, parent)) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push({ ...m, depth })
    moduleTree(data, m.id, depth + 1, out, seen)
  }
  return out
}

/** Tot ce atârnă sub un modul, la orice adâncime. */
export function descendants(data: OsData, id: string): OsModule[] {
  const out: OsModule[] = []
  const seen = new Set<string>()
  const walk = (parent: string): void => {
    for (const m of childrenOf(data, parent)) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
      walk(m.id)
    }
  }
  walk(id)
  return out
}

/** Drumul de la rădăcină până la modul, pentru firul de navigare. */
export function pathOf(data: OsData, id: string): OsModule[] {
  const out: OsModule[] = []
  let current = moduleById(data, id)
  let guard = 0
  while (current && guard++ < 32) {
    out.unshift(current)
    current = current.parent ? moduleById(data, current.parent) : undefined
  }
  return out
}

export const itemsOf = <T extends { mod?: string }>(bag: Record<string, T>, mod: string): T[] =>
  Object.values(bag).filter(item => (item.mod ?? '') === mod)

/**
 * Ce e în modul plus ce e în tot ce atârnă sub el.
 *
 * Un modul părinte fără asta arată gol de îndată ce ți-ai împărțit lucrurile
 * pe submodule — exact când începi să ai destule cât să merite împărțite.
 * Așa, părintele e privirea de ansamblu, iar submodulul e filtrul.
 */
export function itemsUnder<T extends { mod?: string }>(
  data: OsData, bag: Record<string, T>, mod: string,
): T[] {
  const ids = new Set([mod, ...descendants(data, mod).map(child => child.id)])
  return Object.values(bag).filter(item => ids.has(item.mod ?? ''))
}
