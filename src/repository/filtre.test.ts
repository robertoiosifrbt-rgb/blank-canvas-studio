import { describe, expect, it } from 'vitest'

import { pentruAzi, pentruCalendar, vii } from './filtre'
import type { Item } from './item'

const AZI = '2026-09-04'

function item(id: string, peste: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: null,
    state: 'inbox',
    title: `titlul ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    ...peste,
  }
}

const task = (id: string, peste: Partial<Item> = {}) =>
  item(id, { state: 'active', kind: 'task', ...peste })

describe('vii', () => {
  it('scoate rândurile șterse, și numai pe ele', () => {
    const listă = [item('a'), item('b', { deleted_at: '2026-09-03T00:00:00+00:00' })]
    expect(vii(listă).map((i) => i.id)).toEqual(['a'])
  })
})

describe('pentruAzi', () => {
  it('arată un lucru capturat, deși nu are dată', () => {
    // Fără OR-ul pe state, scrii „sun la X" și nu apare nicăieri.
    const grupuri = pentruAzi([item('capturat')], AZI)
    expect(grupuri.inbox.map((i) => i.id)).toEqual(['capturat'])
  })

  it('arată un task activ fără dată, ca să nu se evapore la procesare', () => {
    const grupuri = pentruAzi([task('bormașină')], AZI)
    expect(grupuri.fărăDată.map((i) => i.id)).toEqual(['bormașină'])
  })

  it('împarte în patru grupuri, după dată', () => {
    const grupuri = pentruAzi(
      [
        item('capturat'),
        task('astăzi', { due: AZI }),
        task('ieri', { due: '2026-09-03' }),
        task('luna-trecută', { due: '2026-08-20' }),
        task('nedatat'),
      ],
      AZI,
    )

    expect(grupuri.inbox.map((i) => i.id)).toEqual(['capturat'])
    expect(grupuri.azi.map((i) => i.id)).toEqual(['astăzi'])
    expect(grupuri.restanțe.map((i) => i.id)).toEqual(['luna-trecută', 'ieri'])
    expect(grupuri.fărăDată.map((i) => i.id)).toEqual(['nedatat'])
  })

  it('nu aduce în Azi ce e planificat mai încolo', () => {
    const grupuri = pentruAzi([task('săptămâna-viitoare', { due: '2026-09-11' })], AZI)
    expect(grupuri).toEqual({ inbox: [], azi: [], restanțe: [], fărăDată: [] })
  })

  it('nu aduce în Azi ce e gata sau șters', () => {
    const grupuri = pentruAzi(
      [
        task('gata', { state: 'done', due: AZI, done_at: AZI }),
        task('aruncat', { due: AZI, deleted_at: '2026-09-04T08:00:00+00:00' }),
      ],
      AZI,
    )
    expect(grupuri.azi).toEqual([])
    expect(grupuri.restanțe).toEqual([])
  })

  it('pune cel mai vechi în cap, în inbox și în fără dată', () => {
    const grupuri = pentruAzi(
      [
        item('nou', { created_at: '2026-09-03T10:00:00+00:00' }),
        item('vechi', { created_at: '2026-08-12T10:00:00+00:00' }),
        task('nedatat-nou', { created_at: '2026-09-02T10:00:00+00:00' }),
        task('nedatat-vechi', { created_at: '2026-08-14T10:00:00+00:00' }),
      ],
      AZI,
    )
    expect(grupuri.inbox.map((i) => i.id)).toEqual(['vechi', 'nou'])
    expect(grupuri.fărăDată.map((i) => i.id)).toEqual([
      'nedatat-vechi',
      'nedatat-nou',
    ])
  })
})

describe('pentruCalendar', () => {
  it('pune un task due luni și terminat miercuri în ambele zile', () => {
    const zile = pentruCalendar([
      task('mutat', { state: 'done', due: '2026-09-07', done_at: '2026-09-09' }),
    ])

    expect(zile.map((z) => z.zi)).toEqual(['2026-09-07', '2026-09-09'])
    expect(zile[0]?.planificat.map((i) => i.id)).toEqual(['mutat'])
    expect(zile[0]?.făcut).toEqual([])
    expect(zile[1]?.planificat).toEqual([])
    expect(zile[1]?.făcut.map((i) => i.id)).toEqual(['mutat'])
  })

  it('arată un task fără dată, terminat, în ziua în care l-ai bifat', () => {
    // De-aia done_at există: ca nimic terminat să nu dispară din toate ecranele.
    const zile = pentruCalendar([
      task('nedatat', { state: 'done', done_at: '2026-09-09' }),
    ])
    expect(zile).toHaveLength(1)
    expect(zile[0]?.făcut.map((i) => i.id)).toEqual(['nedatat'])
  })

  it('nu arată zilele rândurilor șterse', () => {
    const zile = pentruCalendar([
      task('aruncat', { due: '2026-09-07', deleted_at: '2026-09-08T00:00:00+00:00' }),
    ])
    expect(zile).toEqual([])
  })

  it('dă zilele în ordine', () => {
    const zile = pentruCalendar([
      task('c', { due: '2026-09-11' }),
      task('a', { due: '2026-09-05' }),
      task('b', { due: '2026-09-07' }),
    ])
    expect(zile.map((z) => z.zi)).toEqual(['2026-09-05', '2026-09-07', '2026-09-11'])
  })
})
