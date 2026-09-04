import { describe, expect, it } from 'vitest'

import { citeșteConfigurațiaSupabase } from './env'

const COMPLET = {
  VITE_SUPABASE_URL: 'https://exemplu.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplu',
}

describe('citeșteConfigurațiaSupabase', () => {
  it('întoarce valorile din mediu', () => {
    expect(citeșteConfigurațiaSupabase(COMPLET)).toEqual({
      url: 'https://exemplu.supabase.co',
      cheiePublishable: 'sb_publishable_exemplu',
    })
  })

  it('taie spațiile din jur', () => {
    expect(
      citeșteConfigurațiaSupabase({
        VITE_SUPABASE_URL: '  https://exemplu.supabase.co  ',
        VITE_SUPABASE_PUBLISHABLE_KEY: '\tsb_publishable_exemplu\n',
      }).url,
    ).toBe('https://exemplu.supabase.co')
  })

  it('nu tratează o variabilă goală ca pe o valoare', () => {
    expect(() =>
      citeșteConfigurațiaSupabase({ ...COMPLET, VITE_SUPABASE_URL: '   ' }),
    ).toThrow('VITE_SUPABASE_URL')
  })

  it('spune pe nume tot ce lipsește, nu doar prima variabilă', () => {
    expect(() => citeșteConfigurațiaSupabase({})).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/,
    )
  })
})
