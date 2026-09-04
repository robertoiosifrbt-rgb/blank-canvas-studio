import { describe, expect, it } from 'vitest'

import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('translates the codes it knows', () => {
    expect(
      errorMessage({
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      }),
    ).toBe('Wrong email or password.')
    expect(errorMessage({ code: 'weak_password', message: 'Password too short' })).toBe(
      'That password is too weak. Pick a longer one.',
    )
  })

  it('does not hide a code it does not know', () => {
    expect(errorMessage({ code: 'something_new', message: 'Something specific broke' })).toBe(
      'It did not work: Something specific broke',
    )
  })

  it('copes with no code and no message', () => {
    expect(errorMessage({ message: 'Just the text' })).toBe(
      'It did not work: Just the text',
    )
    expect(errorMessage({})).toBe('It did not work, with no reason given.')
    expect(errorMessage({ message: '   ' })).toBe(
      'It did not work, with no reason given.',
    )
    expect(errorMessage(null)).toBe('It did not work, with no reason given.')
  })
})
