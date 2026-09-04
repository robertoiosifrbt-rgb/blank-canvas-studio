import { describe, expect, it } from 'vitest'

import { fișierDeExport } from './export'
import type { Item } from './item'

const ACUM = new Date('2026-09-04T18:30:00.000Z')

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

describe('fișierDeExport', () => {
  it('scrie tot snapshot-ul, inclusiv rândurile șterse', () => {
    const fișier = fișierDeExport(
      'a',
      [item('unu'), item('doi', { deleted_at: '2026-09-03T00:00:00+00:00' })],
      '2026-09-03T00:00:00+00:00',
      ACUM,
    )
    const citit = JSON.parse(fișier.conținut) as { itemi: Item[] }

    expect(citit.itemi.map((i) => i.id)).toEqual(['unu', 'doi'])
  })

  it('spune până când e sincronizat, ca să nu promită mai mult decât știe', () => {
    const fișier = fișierDeExport('a', [], '2026-09-03T00:00:00+00:00', ACUM)
    const citit = JSON.parse(fișier.conținut) as Record<string, unknown>

    expect(citit['sincronizatPânăLa']).toBe('2026-09-03T00:00:00+00:00')
    expect(citit['exportatLa']).toBe('2026-09-04T18:30:00.000Z')
    expect(citit['utilizator']).toBe('a')
  })

  it('e un fișier gol valid când n-ai nimic', () => {
    const fișier = fișierDeExport('a', [], null, ACUM)
    const citit = JSON.parse(fișier.conținut) as { itemi: Item[] }

    expect(citit.itemi).toEqual([])
    expect(fișier.nume).toBe('life-control-centre-2026-09-04.json')
  })
})
