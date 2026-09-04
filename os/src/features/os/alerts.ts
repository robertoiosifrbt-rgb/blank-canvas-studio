import { activePlan, currentHolder, everyLabel, nextDue, remaining } from './debts'
import { money } from './format'
import type { Alarm } from './push'
import type { OsData } from './types'

/**
 * Alarmele, scoase din ce ai deja. Nimic de programat de mână.
 *
 * Un lucru cu o dată produce o alarmă, nu două: o scrisoare cu termen sună o
 * dată, chiar dacă e legată și de o datorie. Id-ul e făcut din ce o produce,
 * deci recalcularea listei dă aceleași id-uri și nu se dublează nimic.
 *
 * Textul poartă ce-ți trebuie ca să acționezi — telefonul și referința —
 * pentru că o notificare pe care trebuie s-o traduci deschizând aplicația nu
 * te-a ajutat cu nimic.
 */

export interface AlertSettings {
  /** Cu câte zile înainte. */
  lead: number
  /** La ce oră, în ora telefonului. */
  hour: number
}

export const DEFAULT_ALERTS: AlertSettings = { lead: 1, hour: 9 }

/** Momentul la care sună pentru o zi anume. */
function ringAt(date: string, { lead, hour }: AlertSettings): string {
  const when = new Date(`${date}T12:00:00`)
  if (Number.isNaN(when.getTime())) return ''
  when.setDate(when.getDate() - lead)
  when.setHours(hour, 0, 0, 0)
  return when.toISOString()
}

const soon = (iso: string): boolean =>
  iso !== '' && Date.parse(iso) > Date.now() - 60_000

export function buildAlarms(data: OsData, settings: AlertSettings = DEFAULT_ALERTS): Alarm[] {
  const currency = data.settings.currency
  const out: Alarm[] = []
  const add = (id: string, date: string, title: string, body: string) => {
    const at = ringAt(date, settings)
    if (soon(at)) out.push({ id, title, body, url: '/', scheduledAt: at })
  }

  for (const task of Object.values(data.tasks)) {
    if (task.due && !task.done) add(`task:${task.id}`, task.due, task.title, 'Termen.')
  }

  for (const doc of Object.values(data.docs ?? {})) {
    if (!doc.due || doc.done) continue
    add(`doc:${doc.id}`, doc.due, doc.title,
      [doc.from, doc.ref ? `ref. ${doc.ref}` : ''].filter(Boolean).join(' · ') || 'Termen.')
  }

  for (const debt of Object.values(data.debts)) {
    const left = remaining(data, debt)
    if (left <= 0) continue
    const holder = currentHolder(debt)
    const org = holder ? data.orgs?.[holder.org] : undefined
    const who = [org?.name, org?.phone, holder?.ref ? `ref. ${holder.ref}` : '']
      .filter(Boolean).join(' · ')

    const plan = activePlan(debt)
    const due = plan ? nextDue(plan) : undefined
    if (plan && due) {
      add(`plan:${debt.id}:${due}`, due, `${debt.name} — rată ${everyLabel(plan.every)}`,
        [money(plan.amount, currency), who].filter(Boolean).join(' · '))
    }

    if (debt.due) add(`debt:${debt.id}`, debt.due, `${debt.name} — termen`,
      [money(left, currency), who].filter(Boolean).join(' · '))

    for (const action of debt.actions ?? []) {
      if (!action.followUp) continue
      add(`follow:${action.id}`, action.followUp, `${debt.name} — de reluat`,
        [action.summary, who].filter(Boolean).join(' · '))
    }
  }

  for (const goal of Object.values(data.goals)) {
    if (goal.due) add(`goal:${goal.id}`, goal.due, goal.name, 'Termenul obiectivului.')
  }

  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}
