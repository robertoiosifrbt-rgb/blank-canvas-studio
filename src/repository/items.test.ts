import { describe, expect, it } from 'vitest'

import { assertAccount } from './items'

describe('assertAccount', () => {
  it('passes when the namespace belongs to the current account', () => {
    expect(() =>
      assertAccount('a', { userId: 'a', email: 'a@example.com' }),
    ).not.toThrow()
  })

  it('refuses when nobody is signed in', () => {
    expect(() => assertAccount('a', null)).toThrow('Nobody is signed in')
  })

  it("refuses another account's cache", () => {
    // Sign out of A, sign in as B: A's data does not appear for a moment.
    expect(() =>
      assertAccount('a', { userId: 'b', email: 'b@example.com' }),
    ).toThrow('the current account is another')
  })
})
