import { describe, expect, it } from 'vitest'

import { mesajulErorii } from './erori'

describe('mesajulErorii', () => {
  it('traduce codurile pe care le știe', () => {
    expect(
      mesajulErorii({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    ).toBe('Email sau parolă greșite.')
    expect(mesajulErorii({ code: 'weak_password', message: 'Password too short' })).toBe(
      'Parola e prea slabă. Alege una mai lungă.',
    )
  })

  it('nu ascunde un cod pe care nu-l știe', () => {
    expect(
      mesajulErorii({ code: 'ceva_nou', message: 'Something specific broke' }),
    ).toBe('Nu a mers: Something specific broke')
  })

  it('se descurcă fără cod și fără mesaj', () => {
    expect(mesajulErorii({ message: 'Doar textul' })).toBe('Nu a mers: Doar textul')
    expect(mesajulErorii({})).toBe('Nu a mers, fără motiv dat.')
    expect(mesajulErorii({ message: '   ' })).toBe('Nu a mers, fără motiv dat.')
    expect(mesajulErorii(null)).toBe('Nu a mers, fără motiv dat.')
  })
})
