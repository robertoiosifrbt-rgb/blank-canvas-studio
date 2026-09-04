import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import { RESTRICTED_IMPORTS } from '../../eslint.config.js'

/**
 * Law 4 moves from text into CI. This test checks exactly that: that the rule
 * really does refuse, and that it is switched off only in src/repository/.
 *
 * Without it, a mistake in the import patterns would give a green lint that
 * checks nothing — precisely the failure the plan guards against.
 */

/** A minimal ESLint with only law 4, so it needs no type information. */
const law4Only = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: { parser: tseslint.parser },
      plugins: { '@typescript-eslint': tseslint.plugin },
      rules: { '@typescript-eslint/no-restricted-imports': RESTRICTED_IMPORTS },
    },
  ],
})

async function problems(code, filePath) {
  const results = await law4Only.lintText(code, { filePath })
  return results.flatMap((r) => r.messages)
}

const SCREEN_PATH = 'src/screens/today/TodayScreen.tsx'

describe('law 4, enforced by ESLint', () => {
  it.each([
    ["import { createClient } from '@supabase/supabase-js'", 'the package'],
    ["import type { User } from '@supabase/supabase-js'", 'a type from the package'],
    ["import { supabase } from '../../repository/supabaseClient'", 'the client, relative'],
    ["export { supabase } from '../../repository/supabaseClient'", 're-exporting the client'],
  ])('refuses %s (%s)', async (code) => {
    const messages = await problems(code, SCREEN_PATH)
    expect(messages).toHaveLength(1)
    expect(messages[0].ruleId).toBe('@typescript-eslint/no-restricted-imports')
  })

  it.each([
    "import { useState } from 'react'",
    "import { today } from '../../repository/items'",
    "import { NotBuilt } from '../../ui/NotBuilt'",
  ])('lets %s through', async (code) => {
    expect(await problems(code, SCREEN_PATH)).toEqual([])
  })
})

describe('where law 4 is switched off', () => {
  const config = new ESLint({ overrideConfigFile: 'eslint.config.js' })

  /** The severity the rule reaches a file with: 2 = error, 0 = off. */
  async function severity(filePath) {
    const resolved = await config.calculateConfigForFile(filePath)
    return resolved.rules['@typescript-eslint/no-restricted-imports'][0]
  }

  it('is on for a screen', async () => {
    expect(await severity(SCREEN_PATH)).toBe(2)
  })

  it('is off in src/repository/', async () => {
    expect(await severity('src/repository/supabase.ts')).toBe(0)
  })

  it('is on for a file that merely looks similar', async () => {
    expect(await severity('src/screens/fake-repository/Screen.tsx')).toBe(2)
  })
})
