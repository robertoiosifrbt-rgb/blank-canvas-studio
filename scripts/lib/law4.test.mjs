import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import { IMPORTURI_INTERZISE } from '../../eslint.config.js'

/**
 * Legea 4 trece din text în CI. Testul de aici verifică exact asta: că regula
 * chiar respinge, și că e stinsă numai în src/repository/.
 *
 * Fără el, o greșeală în tiparele de import ar da un lint verde care nu
 * verifică nimic — exact eșecul de care planul se ferește.
 */

/** Un ESLint minim, cu doar regula legii 4, ca să nu ceară tipuri. */
const doarLegea4 = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: { parser: tseslint.parser },
      plugins: { '@typescript-eslint': tseslint.plugin },
      rules: { '@typescript-eslint/no-restricted-imports': IMPORTURI_INTERZISE },
    },
  ],
})

async function abateri(cod, cale) {
  const rezultate = await doarLegea4.lintText(cod, { filePath: cale })
  return rezultate.flatMap((r) => r.messages)
}

const CALE_ECRAN = 'src/screens/azi/AziScreen.tsx'

describe('legea 4, impusă de ESLint', () => {
  it.each([
    ["import { createClient } from '@supabase/supabase-js'", 'pachetul'],
    ["import type { User } from '@supabase/supabase-js'", 'un tip din pachet'],
    ["import { supabase } from '../../repository/supabaseClient'", 'clientul, relativ'],
    ["export { supabase } from '../../repository/supabaseClient'", 'clientul, re-exportat'],
  ])('respinge %s (%s)', async (cod) => {
    const mesaje = await abateri(cod, CALE_ECRAN)
    expect(mesaje).toHaveLength(1)
    expect(mesaje[0].ruleId).toBe('@typescript-eslint/no-restricted-imports')
  })

  it.each([
    "import { useState } from 'react'",
    "import { listeazăItemi } from '../../repository/items'",
    "import { Neconstruit } from '../../ui/Neconstruit'",
  ])('lasă să treacă %s', async (cod) => {
    expect(await abateri(cod, CALE_ECRAN)).toEqual([])
  })
})

describe('unde e stinsă legea 4', () => {
  const config = new ESLint({ overrideConfigFile: 'eslint.config.js' })

  /** Severitatea cu care regula ajunge la un fișier: 2 = error, 0 = off. */
  async function severitate(cale) {
    const rezolvat = await config.calculateConfigForFile(cale)
    return rezolvat.rules['@typescript-eslint/no-restricted-imports'][0]
  }

  it('e pornită pentru un ecran', async () => {
    expect(await severitate(CALE_ECRAN)).toBe(2)
  })

  it('e stinsă în src/repository/', async () => {
    expect(await severitate('src/repository/supabaseClient.ts')).toBe(0)
  })

  it('e pornită pentru un fișier care doar seamănă', async () => {
    expect(await severitate('src/screens/repository-fals/Ecran.tsx')).toBe(2)
  })
})
