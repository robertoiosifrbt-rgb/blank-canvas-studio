import { describe, expect, it } from 'vitest'

import {
  earnedPence,
  earningFromRow,
  isOut,
  kilometres,
  minutesWorked,
  sessionFromRow,
  shiftFromRow,
} from './shift'
import type { Shift } from './shift'

function shift(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: null,
    odo_end: null,
    tips: null,
    personal_km: null,
    rate_tax_pct: null,
    rate_ni_pct: null,
    rate_fuel_per_km: null,
    rate_vehicle_per_km: null,
    sessions: [],
    earnings: [],
    ...over,
  }
}

describe('sessionFromRow', () => {
  it('takes a session that is still open', () => {
    expect(
      sessionFromRow({ id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null }),
    ).toEqual({ id: 's1', started_at: '2026-09-05T09:00:00+00:00', ended_at: null })
  })

  it('refuses one that ends before it starts, as the database does', () => {
    expect(() =>
      sessionFromRow({
        id: 's1',
        started_at: '2026-09-05T09:00:00+00:00',
        ended_at: '2026-09-05T08:00:00+00:00',
      }),
    ).toThrow('ends before it starts')
  })
})

describe('earningFromRow', () => {
  it('reads the amount PostgREST hands back as text', () => {
    expect(earningFromRow({ platform: 'uber_eats', amount: '64.20' })).toEqual({
      platform: 'uber_eats',
      amount: 64.2,
    })
  })

  it('refuses a platform nobody drives for', () => {
    expect(() => earningFromRow({ platform: 'bolt', amount: '5' })).toThrow('bolt')
  })

  it('refuses a platform that paid less than nothing', () => {
    expect(() => earningFromRow({ platform: 'just_eat', amount: '-1' })).toThrow(
      'less than nothing',
    )
  })
})

describe('shiftFromRow', () => {
  it('refuses an odometer that runs backwards', () => {
    expect(() =>
      shiftFromRow({ item_id: 'i1', owner: 'me', odo_start: '100', odo_end: '90' }, [], []),
    ).toThrow('backwards')
  })
})

describe('kilometres', () => {
  it('is the difference between the two readings', () => {
    expect(kilometres(shift({ odo_start: 120345, odo_end: 120512.4 }))).toBeCloseTo(167.4)
  })

  it('is unknown until both readings are there, not zero', () => {
    expect(kilometres(shift({ odo_start: 120345 }))).toBeNull()
    expect(kilometres(shift({ odo_end: 120512 }))).toBeNull()
  })
})

describe('minutesWorked', () => {
  const finished = {
    id: 's1',
    started_at: '2026-09-05T09:00:00+00:00',
    ended_at: '2026-09-05T12:30:00+00:00',
  }
  const open = { id: 's2', started_at: '2026-09-05T17:00:00+00:00', ended_at: null }

  it('adds up every session that has finished', () => {
    expect(minutesWorked(shift({ sessions: [finished] }))).toBe(210)
  })

  it('counts a session that runs past midnight for what it is', () => {
    expect(
      minutesWorked(
        shift({
          sessions: [
            {
              id: 's3',
              started_at: '2026-09-05T21:00:00+00:00',
              ended_at: '2026-09-06T01:00:00+00:00',
            },
          ],
        }),
      ),
    ).toBe(240)
  })

  it('leaves out the one still running, and says so separately', () => {
    const both = shift({ sessions: [finished, open] })
    expect(minutesWorked(both)).toBe(210)
    expect(isOut(both)).toBe(true)
    expect(isOut(shift({ sessions: [finished] }))).toBe(false)
  })
})

describe('earnedPence', () => {
  it('adds the platforms and the tips, in pence', () => {
    const day = shift({
      tips: 12.5,
      personal_km: null,
      earnings: [
        { platform: 'uber_eats', amount: 64.2 },
        { platform: 'deliveroo', amount: 31.0 },
        { platform: 'just_eat', amount: 18.75 },
      ],
    })
    expect(earnedPence(day)).toBe(12645)
  })

  it('does not drift the way adding the pounds would', () => {
    // 0.1 + 0.2 in floating point is not 0.3, and a month of shifts adds up
    // the error in the direction nobody checks.
    const day = shift({
      earnings: [
        { platform: 'uber_eats', amount: 0.1 },
        { platform: 'deliveroo', amount: 0.2 },
      ],
    })
    expect(earnedPence(day)).toBe(30)
  })

  it('is nothing at all for a shift with nothing written in it', () => {
    expect(earnedPence(shift())).toBe(0)
  })
})
