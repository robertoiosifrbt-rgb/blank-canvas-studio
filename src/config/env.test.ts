import { describe, expect, it } from 'vitest'

import { readSupabaseConfig } from './env'

const COMPLETE = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
}

describe('readSupabaseConfig', () => {
  it('returns the values from the environment', () => {
    expect(readSupabaseConfig(COMPLETE)).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: '  https://example.supabase.co  ',
        VITE_SUPABASE_PUBLISHABLE_KEY: '\tsb_publishable_example\n',
      }).url,
    ).toBe('https://example.supabase.co')
  })

  it('does not treat a blank variable as a value', () => {
    expect(() =>
      readSupabaseConfig({ ...COMPLETE, VITE_SUPABASE_URL: '   ' }),
    ).toThrow('VITE_SUPABASE_URL')
  })

  it('names everything that is missing, not just the first one', () => {
    expect(() => readSupabaseConfig({})).toThrow(
      /VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY/,
    )
  })
})
