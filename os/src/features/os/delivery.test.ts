import { describe, expect, it } from 'vitest'
import { DEFAULT_RATES, daysOf, hoursOf, summarise, totalsOf } from './delivery'
import { emptyOsData, type OsData, type Workday } from './types'

const day = (extra: Partial<Workday> = {}): Workday =>
  ({ id: 'w1', mod: 'livrari', date: '2026-09-01', done: true, ...extra })

function withDay(extra: Partial<Workday> = {}): OsData {
  const data = emptyOsData()
  data.settings.delivery = DEFAULT_RATES
  const d = day(extra)
  data.workdays[d.id] = d
  return data
}

describe('orele unei ture', () => {
  it('scad pauza', () => {
    expect(hoursOf(day({ from: '10:00', to: '18:00', breakMinutes: 30 }))).toBe(7.5)
  })

  it('trec de miezul nopții', () => {
    expect(hoursOf(day({ from: '20:00', to: '02:00' }))).toBe(6)
  })

  it('sunt zero fără ore scrise', () => {
    expect(hoursOf(day())).toBe(0)
  })

  it('nu ies negative dintr-o pauză mai lungă decât tura', () => {
    expect(hoursOf(day({ from: '10:00', to: '11:00', breakMinutes: 120 }))).toBe(0)
  })
})

describe('socoteala unei ture', () => {
  const full = withDay({
    from: '10:00', to: '18:00', breakMinutes: 30,
    odoStart: 1000, odoEnd: 1200, personalKm: 20,
    uber: 60, deliveroo: 40, justEat: 20, otherPlatform: 0, tips: 10, bonuses: 5,
    parking: 4, tolls: 2, otherCost: 0,
  })
  const t = totalsOf(full, full.workdays.w1)

  it('scoate kilometrii de business din cei personali', () => {
    expect(t.totalKm).toBe(200)
    expect(t.businessKm).toBe(180)
  })

  it('adună câștigul din platforme, bacșiș și bonus', () => {
    expect(t.platform).toBe(120)
    expect(t.gross).toBe(135)
  })

  it('dă câștigul pe oră și pe kilometru', () => {
    expect(t.perHour).toBeCloseTo(135 / 7.5, 6)
    expect(t.perKm).toBeCloseTo(135 / 180, 6)
  })

  it('socotește combustibilul din kilometrii de business', () => {
    expect(t.fuel).toBeCloseTo(180 * 0.12, 6)
  })

  it('scade toate cheltuielile din brut', () => {
    expect(t.totalExpenses).toBeCloseTo(180 * 0.12 + 4 + 2, 6)
    expect(t.profit).toBeCloseTo(135 - (180 * 0.12 + 6), 6)
  })

  it('pune deoparte taxe, NI și fondul de mașină', () => {
    expect(t.taxReserve).toBeCloseTo(t.profit * 0.2, 6)
    expect(t.niReserve).toBeCloseTo(t.profit * 0.06, 6)
    expect(t.vehicleReserve).toBeCloseTo(180 * 0.05, 6)
    expect(t.available).toBeCloseTo(t.profit - t.reserves, 6)
  })

  it('nu pune rezerve dintr-o zi în pierdere', () => {
    const bad = withDay({ from: '10:00', to: '12:00', odoStart: 0, odoEnd: 100, uber: 5 })
    const lost = totalsOf(bad, bad.workdays.w1)
    expect(lost.profit).toBeLessThan(0)
    expect(lost.taxReserve).toBe(0)
    expect(lost.niReserve).toBe(0)
  })

  it('spune cât ai trimis peste sau sub ce era disponibil', () => {
    const sent = withDay({ ...full.workdays.w1, toDebt: 50 })
    const totals = totalsOf(sent, sent.workdays.w1)
    expect(totals.debtDifference).toBeCloseTo(50 - totals.available, 6)
  })

  it('folosește consumul mașinii, când e știut', () => {
    const data = withDay({ odoStart: 0, odoEnd: 100, vehicle: 'v1' })
    data.vehicles.v1 = { id: 'v1', name: 'Duba', fuelPerKm: 0.25 }
    expect(totalsOf(data, data.workdays.w1).fuel).toBeCloseTo(25, 6)
  })

  it('ține procentele zilei, ca o setare schimbată azi să nu rescrie trecutul', () => {
    const data = withDay({ rates: { taxPct: 0.4, niPct: 0, fuelPerKm: 0, vehPerKm: 0 }, uber: 100 })
    data.settings.delivery = { taxPct: 0.1, niPct: 0.1, fuelPerKm: 1, vehPerKm: 1 }
    expect(totalsOf(data, data.workdays.w1).taxReserve).toBeCloseTo(40, 6)
  })
})

describe('totalurile pe mai multe zile', () => {
  it('numără doar zilele terminate', () => {
    const data = emptyOsData()
    data.settings.delivery = DEFAULT_RATES
    data.workdays.a = day({ id: 'a', date: '2026-09-01', uber: 100, done: true })
    data.workdays.b = day({ id: 'b', date: '2026-09-02', uber: 999, done: false })
    const sum = summarise(data, daysOf(data, 'livrari'))
    expect(sum.days).toBe(1)
    expect(sum.gross).toBe(100)
  })

  it('pune zilele cele mai noi primele', () => {
    const data = emptyOsData()
    data.workdays.a = day({ id: 'a', date: '2026-09-01' })
    data.workdays.b = day({ id: 'b', date: '2026-09-05' })
    expect(daysOf(data, 'livrari').map(d => d.date)).toEqual(['2026-09-05', '2026-09-01'])
  })
})
