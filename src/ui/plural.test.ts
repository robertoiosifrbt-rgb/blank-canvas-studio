import { describe, expect, it } from 'vitest'

import { plural } from './plural'

describe('plural', () => {
  it('uses the singular for one', () => {
    expect(plural(1, 'thing', 'things')).toBe('1 thing')
  })

  it('uses the plural for everything else, zero included', () => {
    expect(plural(0, 'thing', 'things')).toBe('0 things')
    expect(plural(14, 'thing', 'things')).toBe('14 things')
  })
})
