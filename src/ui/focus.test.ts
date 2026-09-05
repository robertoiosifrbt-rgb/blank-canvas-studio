import { describe, expect, it } from 'vitest'

import { nextFocus } from './focus'

const order = ['close', 'title', 'save']

describe('nextFocus', () => {
  it('wraps from the last one round to the first', () => {
    expect(nextFocus(order, 'save', false)).toBe('close')
  })

  it('wraps from the first one back to the last', () => {
    expect(nextFocus(order, 'close', true)).toBe('save')
  })

  it('lets the browser do the ordinary steps in between', () => {
    expect(nextFocus(order, 'title', false)).toBeNull()
    expect(nextFocus(order, 'title', true)).toBeNull()
  })

  it('pulls the focus back in when it is adrift outside', () => {
    expect(nextFocus(order, 'somewhere else', false)).toBe('close')
    expect(nextFocus(order, 'somewhere else', true)).toBe('save')
    expect(nextFocus(order, null, false)).toBe('close')
  })

  it('has nowhere to send it when there is nothing to focus', () => {
    expect(nextFocus([], 'close', false)).toBeNull()
    expect(nextFocus([], null, true)).toBeNull()
  })

  it('keeps a single control focused on itself, both ways', () => {
    expect(nextFocus(['only'], 'only', false)).toBe('only')
    expect(nextFocus(['only'], 'only', true)).toBe('only')
  })
})
