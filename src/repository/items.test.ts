import { describe, expect, it } from 'vitest'

import { confirmăContul } from './items'

describe('confirmăContul', () => {
  it('trece când namespace-ul e al contului curent', () => {
    expect(() =>
      confirmăContul('a', { utilizator: 'a', email: 'a@exemplu.ro' }),
    ).not.toThrow()
  })

  it('refuză când nu e nimeni autentificat', () => {
    expect(() => confirmăContul('a', null)).toThrow('Nu e nimeni autentificat')
  })

  it('refuză cache-ul altui cont', () => {
    // Logout din A, login în B: datele lui A nu apar nici o clipă.
    expect(() =>
      confirmăContul('a', { utilizator: 'b', email: 'b@exemplu.ro' }),
    ).toThrow('contul curent e altul')
  })
})
