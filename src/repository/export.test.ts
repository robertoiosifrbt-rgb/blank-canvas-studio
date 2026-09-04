import { describe, expect, it } from 'vitest'

import { exportFile } from './export'
import type { Item } from './item'

const NOW = new Date('2026-09-04T18:30:00.000Z')

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner: 'a',
    kind: null,
    state: 'inbox',
    title: `title ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    ...over,
  }
}

describe('exportFile', () => {
  it('writes the whole snapshot, deleted rows included', () => {
    const file = exportFile(
      'a',
      [item('one'), item('two', { deleted_at: '2026-09-03T00:00:00+00:00' })],
      '2026-09-03T00:00:00+00:00',
      NOW,
    )
    const read = JSON.parse(file.contents) as { items: Item[] }

    expect(read.items.map((i) => i.id)).toEqual(['one', 'two'])
  })

  it('says how far it is synced, so it promises no more than it knows', () => {
    const file = exportFile('a', [], '2026-09-03T00:00:00+00:00', NOW)
    const read = JSON.parse(file.contents) as Record<string, unknown>

    expect(read['syncedThrough']).toBe('2026-09-03T00:00:00+00:00')
    expect(read['exportedAt']).toBe('2026-09-04T18:30:00.000Z')
    expect(read['user']).toBe('a')
  })

  it('is a valid empty file when you have nothing', () => {
    const file = exportFile('a', [], null, NOW)
    const read = JSON.parse(file.contents) as { items: Item[] }

    expect(read.items).toEqual([])
    expect(file.name).toBe('life-control-centre-2026-09-04.json')
  })
})
