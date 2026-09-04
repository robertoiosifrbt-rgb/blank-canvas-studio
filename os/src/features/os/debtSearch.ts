import { allRefs } from './debts'
import { matches } from './deliverySearch'
import type { Debt, OsData } from './types'

/**
 * Căutarea prin datorii.
 *
 * O datorie se caută cum ți-o amintești: după numele firmei, după referința
 * de pe scrisoare, după stadiu, sau după ce-ai scris în jurnal. Referințele
 * intră toate — și cele ale firmelor care au ținut-o înainte — pentru că
 * scrisoarea veche poartă numărul vechi.
 */
export const searchDebts = (data: OsData, list: Debt[], query: string): Debt[] =>
  list.filter(debt => matches(query, [
    debt.name, debt.category, debt.status, debt.stage, debt.notes, debt.total,
    debt.direction === 'owed' ? 'mi se datorează' : 'datorez',
    ...allRefs(debt).flatMap(ref => [ref.value, ref.label]),
    ...(debt.holders ?? []).flatMap(h => [data.orgs[h.org]?.name, h.role, h.ref]),
    ...(debt.actions ?? []).flatMap(a => [a.kind, a.summary]),
  ]))
