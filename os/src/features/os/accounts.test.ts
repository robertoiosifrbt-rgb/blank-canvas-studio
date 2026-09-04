import { describe, expect, it } from 'vitest'
import {
  CASH, DELIVEROO, JUST_EAT, SEED, UBER, accountBalance, accountsOf, duePayouts,
  earningsOf, nextPayout, payoutDays, platformBalance, platformTotal,
} from './accounts'
import { emptyOsData, type OsData, type Workday } from './types'

function ready(): OsData {
  const data = emptyOsData()
  for (const account of SEED) data.accounts[account.id] = { ...account }
  data.accounts.bank = { id: 'bank', name: 'Monzo business', kind: 'bank' }
  for (const account of Object.values(data.accounts)) {
    if (account.kind === 'platform') account.payTo = 'bank'
  }
  return data
}

const day = (extra: Partial<Workday> = {}): Workday =>
  ({ id: `w${Math.random()}`, mod: 'livrari', date: '2026-09-01', done: true, ...extra })

const add = (data: OsData, extra: Partial<Workday>): void => {
  const w = day(extra)
  data.workdays[w.id] = w
}

describe('câștigul unei ture, pe conturi', () => {
  it('se citește din hartă', () => {
    expect(earningsOf(day({ earnings: { [UBER]: 40, [DELIVEROO]: 20 } }))).toEqual({ [UBER]: 40, [DELIVEROO]: 20 })
  })

  it('se citește din câmpurile vechi la turele dinainte de conturi', () => {
    expect(earningsOf(day({ uber: 30, justEat: 10 }))).toEqual({ [UBER]: 30, [JUST_EAT]: 10 })
  })

  it('adună totul, oricum ar fi scrisă tura', () => {
    expect(platformTotal(day({ uber: 30, deliveroo: 20 }))).toBe(50)
    expect(platformTotal(day({ earnings: { [UBER]: 30, [DELIVEROO]: 20 } }))).toBe(50)
  })
})

describe('soldul unei platforme', () => {
  it('crește cu turele închise', () => {
    const data = ready()
    add(data, { earnings: { [UBER]: 40 } })
    add(data, { earnings: { [UBER]: 25 } })
    expect(platformBalance(data, UBER)).toBe(65)
  })

  it('nu numără turele neterminate', () => {
    const data = ready()
    add(data, { earnings: { [UBER]: 40 }, done: false })
    expect(platformBalance(data, UBER)).toBe(0)
  })

  it('scade ce a plecat spre bancă', () => {
    const data = ready()
    add(data, { earnings: { [UBER]: 40 } })
    data.finance['2026-09'] = { items: [
      { id: 'p1', date: '2026-09-03', type: 'in', amount: 40, account: 'bank', from: UBER },
    ] }
    expect(platformBalance(data, UBER)).toBe(0)
  })

  it('scade suma întreagă la scoaterea pe loc, nu cea rămasă după comision', () => {
    const data = ready()
    add(data, { earnings: { [UBER]: 40 } })
    data.finance['2026-09'] = { items: [
      { id: 'p1', date: '2026-09-02', type: 'in', amount: 39.5, gross: 40, account: 'bank', from: UBER },
    ] }
    expect(platformBalance(data, UBER)).toBe(0)
  })

  it('nu amestecă platformele', () => {
    const data = ready()
    add(data, { earnings: { [UBER]: 40, [DELIVEROO]: 10 } })
    expect(platformBalance(data, DELIVEROO)).toBe(10)
  })
})

describe('soldul unui cont de bancă sau cash', () => {
  it('adună ce a intrat și scade ce a ieșit', () => {
    const data = ready()
    data.finance['2026-09'] = { items: [
      { id: 'a', date: '2026-09-01', type: 'in', amount: 100, account: 'bank' },
      { id: 'b', date: '2026-09-02', type: 'out', amount: 30, account: 'bank' },
      { id: 'c', date: '2026-09-02', type: 'in', amount: 8, account: CASH },
    ] }
    expect(accountBalance(data, 'bank')).toBe(70)
    expect(accountBalance(data, CASH)).toBe(8)
  })

  it('nu numără mișcările fără cont', () => {
    const data = ready()
    data.finance['2026-09'] = { items: [{ id: 'a', date: '2026-09-01', type: 'in', amount: 100 }] }
    expect(accountBalance(data, 'bank')).toBe(0)
  })
})

describe('ziua următoarei plăți', () => {
  /* 2026-09-04 e o vineri. */
  const vineri = new Date('2026-09-04T10:00:00')

  it('Deliveroo plătește marțea', () => {
    expect(nextPayout({ day: 2, at: '13:00' }, vineri)).toBe('2026-09-08')
  })

  it('Uber plătește miercurea', () => {
    expect(nextPayout({ day: 3, at: '23:59' }, vineri)).toBe('2026-09-09')
  })

  it('Just Eat plătește joia', () => {
    expect(nextPayout({ day: 4, at: '23:59' }, vineri)).toBe('2026-09-10')
  })

  it('dacă azi e ziua și ora n-a trecut, e azi', () => {
    expect(nextPayout({ day: 5, at: '13:00' }, vineri)).toBe('2026-09-04')
  })

  it('dacă ora a trecut, e săptămâna viitoare', () => {
    expect(nextPayout({ day: 5, at: '09:00' }, vineri)).toBe('2026-09-11')
  })
})

describe('zilele de plată dintr-un interval', () => {
  it('sunt din șapte în șapte', () => {
    expect(payoutDays({ day: 2, at: '13:00' }, '2026-09-01', '2026-09-20'))
      .toEqual(['2026-09-01', '2026-09-08', '2026-09-15'])
  })
})

describe('plățile care s-au făcut și nu-s scrise', () => {
  it('apar după ce trece ziua și ora', () => {
    const data = ready()
    add(data, { date: '2026-09-01', earnings: { [DELIVEROO]: 120 } })
    const due = duePayouts(data, new Date('2026-09-08T14:00:00'))
    expect(due).toHaveLength(1)
    expect(due[0].amount).toBe(120)
    expect(due[0].account).toBe('bank')
    expect(due[0].from).toBe(DELIVEROO)
    expect(due[0].date).toBe('2026-09-08')
  })

  it('nu apar înainte de oră', () => {
    const data = ready()
    add(data, { date: '2026-09-01', earnings: { [DELIVEROO]: 120 } })
    expect(duePayouts(data, new Date('2026-09-08T11:00:00'))).toEqual([])
  })

  it('nu se scriu de două ori', () => {
    const data = ready()
    add(data, { date: '2026-09-01', earnings: { [DELIVEROO]: 120 } })
    const first = duePayouts(data, new Date('2026-09-08T14:00:00'))
    data.finance['2026-09'] = { items: first }
    expect(duePayouts(data, new Date('2026-09-08T15:00:00'))).toEqual([])
  })

  it('scad ce ai scos deja pe loc', () => {
    const data = ready()
    add(data, { date: '2026-09-01', earnings: { [DELIVEROO]: 120 } })
    data.finance['2026-09'] = { items: [
      { id: 'cash-out-1', date: '2026-09-02', type: 'in', amount: 49.5, gross: 50, account: 'bank', from: DELIVEROO },
    ] }
    expect(duePayouts(data, new Date('2026-09-08T14:00:00'))[0].amount).toBe(70)
  })

  it('nu apar pe o platformă fără cont bancar pus', () => {
    const data = ready()
    data.accounts[DELIVEROO].payTo = undefined
    add(data, { date: '2026-09-01', earnings: { [DELIVEROO]: 120 } })
    expect(duePayouts(data, new Date('2026-09-08T14:00:00'))).toEqual([])
  })

  it('nu apar pentru zerouri', () => {
    const data = ready()
    add(data, { date: '2026-09-01', earnings: { [UBER]: 10 } })
    const due = duePayouts(data, new Date('2026-09-09T23:59:00'))
    expect(due.map(m => m.from)).toEqual([UBER])
  })
})

describe('conturile', () => {
  it('vin gata făcute, cu ce știm despre fiecare', () => {
    const data = ready()
    expect(accountsOf(data, 'platform').map(a => a.name))
      .toEqual(['Deliveroo', 'Just Eat', 'Uber Eats'])
    expect(data.accounts[UBER].cashOutFee).toBe(0.5)
    expect(data.accounts[DELIVEROO].cashOutFee).toBe(0.5)
    expect(data.accounts[JUST_EAT].cashOutFee).toBeUndefined()
  })
})
