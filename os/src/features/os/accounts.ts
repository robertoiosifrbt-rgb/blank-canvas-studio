import { iso, num } from './format'
import type { Account, Movement, OsData, Workday } from './types'

/**
 * Conturile: unde stau banii înainte să fie ai tăi.
 *
 * O tură nu-ți aduce bani în mână. Îți aduce un sold pe Uber, altul pe
 * Deliveroo, altul pe Just Eat, plătite fiecare în ziua lui. Finanțele văd
 * banii abia când ajung în bancă — altfel ai cheltui bani promiși.
 *
 * Niciun sold nu se salvează. Se socotește din ce ai scris: turele îl urcă,
 * plățile către bancă îl coboară.
 */

/* Conturile cu care pornește modulul. Id-urile sunt fixe pentru că turele
   scrise înainte de conturi se leagă de ele după nume — altfel istoricul ar
   rămâne fără platformă. */
export const UBER = 'acc-uber'
export const DELIVEROO = 'acc-deliveroo'
export const JUST_EAT = 'acc-justeat'
export const CASH = 'acc-cash'

/** Câmpurile vechi ale unei ture și contul în care se traduc. */
const OLD: Array<[keyof Workday, string]> = [
  ['uber', UBER], ['deliveroo', DELIVEROO], ['justEat', JUST_EAT],
]

export const SEED: Account[] = [
  { id: UBER, name: 'Uber Eats', kind: 'platform', cashOutFee: 0.5,
    payout: { day: 3, at: '23:59' } },
  { id: DELIVEROO, name: 'Deliveroo', kind: 'platform', cashOutFee: 0.5,
    payout: { day: 2, at: '13:00' } },
  { id: JUST_EAT, name: 'Just Eat', kind: 'platform',
    payout: { day: 4, at: '23:59' } },
  { id: CASH, name: 'Cash', kind: 'cash' },
]

export const accountsOf = (data: OsData, kind?: Account['kind']): Account[] =>
  Object.values(data.accounts)
    .filter(account => !kind || account.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name))

/**
 * Cât a câștigat fiecare cont într-o tură.
 *
 * Turele noi au harta lor. Cele scrise înainte de conturi au câmpurile vechi,
 * citite aici ca și cum ar fi fost dintotdeauna conturi.
 */
export function earningsOf(day: Workday): Record<string, number> {
  if (day.earnings) return day.earnings
  const out: Record<string, number> = {}
  for (const [field, account] of OLD) {
    const value = num(day[field] as number | undefined)
    if (value) out[account] = value
  }
  if (num(day.otherPlatform)) out[UBER] = (out[UBER] ?? 0) + num(day.otherPlatform)
  return out
}

/** Totalul câștigat de pe platforme într-o tură, oricum ar fi scrisă. */
export const platformTotal = (day: Workday): number =>
  Object.values(earningsOf(day)).reduce((sum, value) => sum + num(value), 0)

/** Ce a intrat pe un cont de platformă din turele închise. */
export const earnedOn = (data: OsData, account: string): number =>
  Object.values(data.workdays)
    .filter(day => day.done)
    .reduce((sum, day) => sum + num(earningsOf(day)[account]), 0)

/** Ce a plecat de pe platformă către bancă: plăți automate și scoateri. */
export const paidOutOf = (data: OsData, account: string): number =>
  Object.values(data.finance)
    .flatMap(month => month.items)
    .filter(item => item.type === 'in' && item.from === account)
    .reduce((sum, item) => sum + num(item.gross ?? item.amount), 0)

/**
 * Soldul unei platforme: ce ai câștigat minus ce a plecat deja spre bancă.
 *
 * La scoaterea pe loc se scade suma întreagă, nu cea rămasă după comision:
 * de pe platformă pleacă tot, iar comisionul e o cheltuială, nu bani rămași.
 */
export const platformBalance = (data: OsData, account: string): number =>
  earnedOn(data, account) - paidOutOf(data, account)

/** Soldul unui cont de bancă sau de cash: suma mișcărilor lui din Finanțe. */
export function accountBalance(data: OsData, account: string): number {
  return Object.values(data.finance)
    .flatMap(month => month.items)
    .filter(item => item.account === account)
    .reduce((sum, item) => sum + (item.type === 'in' ? num(item.amount) : -num(item.amount)), 0)
}

const DAY = 86_400_000
const noon = (date: string): Date => new Date(`${date}T12:00:00`)

/**
 * Ziua următoarei plăți a unei platforme.
 *
 * Se caută înainte, de azi, prima zi din săptămână care se potrivește. Dacă
 * azi e chiar ziua plății și ora n-a trecut, azi e ziua.
 */
export function nextPayout(rule: PayoutRuleLike, from = new Date()): string {
  const start = new Date(from.getTime())
  const passed = start.getHours() * 60 + start.getMinutes() >= minutes(rule.at)
  const ahead = (rule.day - start.getDay() + 7) % 7
  const days = ahead === 0 && passed ? 7 : ahead
  return iso(new Date(start.getTime() + days * DAY))
}

interface PayoutRuleLike { day: number; at: string }

/**
 * Săptămâna pe care o plătește o zi de plată: ultima luni–duminică încheiată
 * înaintea ei.
 *
 * Așa spun toate trei: munca de luni până duminică se plătește marțea,
 * miercurea sau joia care vine. Ziua plății nu-și plătește propria zi.
 */
export function periodFor(payDay: string): { from: string; to: string } {
  const day = noon(payDay)
  const back = day.getDay() === 0 ? 7 : day.getDay()
  const sunday = new Date(day.getTime() - back * DAY)
  return { from: iso(new Date(sunday.getTime() - 6 * DAY)), to: iso(sunday) }
}

const minutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Toate zilele de plată ale unei platforme dintre două date, inclusiv. */
export function payoutDays(rule: PayoutRuleLike, from: string, to: string): string[] {
  const out: string[] = []
  const end = noon(to).getTime()
  let day = noon(from)
  /* Prima zi de plată de la `from` încolo, apoi din șapte în șapte. */
  day = new Date(day.getTime() + ((rule.day - day.getDay() + 7) % 7) * DAY)
  while (day.getTime() <= end) {
    out.push(iso(day))
    day = new Date(day.getTime() + 7 * DAY)
  }
  return out
}

/**
 * Plățile care s-au făcut deja, dar nu sunt încă scrise.
 *
 * Platformele plătesc singure. Aplicația nu are cum să știe că banii au
 * ajuns, dar știe ziua și ora — deci după ce trec, scrie plata. Id-ul e făcut
 * din cont și din ziua plății, așa că recalculul nu poate scrie de două ori
 * aceiași bani.
 */
export function duePayouts(data: OsData, now = new Date()): Movement[] {
  const already = new Set(Object.values(data.finance).flatMap(m => m.items).map(item => item.id))
  const out: Movement[] = []

  for (const account of accountsOf(data, 'platform')) {
    if (!account.payout || !account.payTo) continue
    const first = firstEarning(data, account.id)
    if (!first) continue

    for (const day of payoutDays(account.payout, first, iso(now))) {
      if (day === iso(now) && nowMinutes(now) < minutes(account.payout.at)) continue
      const id = `payout-${account.id}-${day}`
      if (already.has(id)) continue
      const week = periodFor(day)
      const amount = earnedBetween(data, account.id, week.from, week.to)
        - takenSinceLastPayout(data, account.id, day)
      if (amount <= 0) continue
      out.push({
        id, date: day, type: 'in', amount, cat: 'Livrări',
        note: `${account.name} — plată săptămânală`,
        account: account.payTo, from: account.id,
      })
    }
  }
  return out
}

const nowMinutes = (now: Date): number => now.getHours() * 60 + now.getMinutes()

/** Prima zi în care platforma a câștigat ceva. De acolo încep plățile. */
function firstEarning(data: OsData, account: string): string | undefined {
  return Object.values(data.workdays)
    .filter(day => day.done && num(earningsOf(day)[account]) > 0)
    .map(day => day.date)
    .sort()[0]
}

const earnedBetween = (data: OsData, account: string, from: string, to: string): number =>
  Object.values(data.workdays)
    .filter(day => day.done && day.date >= from && day.date <= to)
    .reduce((sum, day) => sum + num(earningsOf(day)[account]), 0)

/**
 * Ce ai scos pe loc de la plata trecută încoace.
 *
 * Se scade din plata care vine: banii ăia au plecat deja de pe platformă.
 * Fereastra e exact de o săptămână, ca o scoatere să nu fie scăzută de două
 * ori, din două plăți.
 */
function takenSinceLastPayout(data: OsData, account: string, payDay: string): number {
  const previous = iso(new Date(noon(payDay).getTime() - 7 * DAY))
  return Object.values(data.finance)
    .flatMap(month => month.items)
    .filter(item => item.from === account && item.type === 'in')
    .filter(item => !item.id.startsWith('payout-'))
    .filter(item => item.date > previous && item.date <= payDay)
    .reduce((sum, item) => sum + num(item.gross ?? item.amount), 0)
}
