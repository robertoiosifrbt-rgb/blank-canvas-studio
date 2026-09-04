import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  citeșteArbore,
  extrageImporturi,
  LIMITA_LINII,
  numărăLinii,
  rezolvăImport,
  verifică,
  verificăCss,
  verificăLinii,
} from './structure.mjs'

/** Un arbore minim și corect, pe care verificatorul trebuie să tacă. */
function arboreCorect() {
  return [
    {
      cale: 'src/main.tsx',
      conținut: "import './styles/tokens.css'\nimport './styles/reset.css'\n",
    },
    { cale: 'src/styles/tokens.css', conținut: ':root { color: red }\n' },
    { cale: 'src/styles/reset.css', conținut: 'body { margin: 0 }\n' },
    { cale: 'src/app/AppShell.tsx', conținut: "import './AppShell.css'\n" },
    { cale: 'src/app/AppShell.css', conținut: '.shell {}\n' },
  ]
}

describe('numărăLinii', () => {
  it('nu numără linia goală de la final ca linie', () => {
    expect(numărăLinii('a\nb\n')).toBe(2)
    expect(numărăLinii('a\nb')).toBe(2)
    expect(numărăLinii('')).toBe(0)
  })
})

describe('verificăLinii', () => {
  it('lasă să treacă exact limita și oprește un rând peste', () => {
    const laLimită = `${'x\n'.repeat(LIMITA_LINII)}`
    const pesteLimită = `${'x\n'.repeat(LIMITA_LINII + 1)}`

    expect(verificăLinii([{ cale: 'src/a.ts', conținut: laLimită }])).toEqual([])
    expect(
      verificăLinii([{ cale: 'src/a.ts', conținut: pesteLimită }]),
    ).toHaveLength(1)
  })

  it('se aplică la .ts și .tsx, nu la altceva', () => {
    const prea = `${'x\n'.repeat(LIMITA_LINII + 1)}`
    expect(verificăLinii([{ cale: 'src/a.tsx', conținut: prea }])).toHaveLength(1)
    expect(verificăLinii([{ cale: 'src/a.css', conținut: prea }])).toEqual([])
    expect(verificăLinii([{ cale: 'src/a.md', conținut: prea }])).toEqual([])
  })
})

describe('extrageImporturi', () => {
  it('prinde toate formele de import și de re-export', () => {
    const cod = [
      "import './a.css'",
      "import React from 'react'",
      "import type { X } from './x'",
      "import { a, b } from '../b'",
      "export * from './c'",
      "export { d } from './d'",
      "const e = await import('./e')",
    ].join('\n')

    expect(extrageImporturi(cod)).toEqual([
      './a.css',
      'react',
      './x',
      '../b',
      './c',
      './d',
      './e',
    ])
  })
})

describe('rezolvăImport', () => {
  it('rezolvă relativ la directorul importatorului', () => {
    expect(rezolvăImport('src/main.tsx', './styles/tokens.css')).toBe(
      'src/styles/tokens.css',
    )
    expect(rezolvăImport('src/ui/Nota.tsx', '../styles/tokens.css')).toBe(
      'src/styles/tokens.css',
    )
  })

  it('ignoră pachetele', () => {
    expect(rezolvăImport('src/main.tsx', 'react')).toBeNull()
  })
})

describe('verificăCss', () => {
  it('tace pe un arbore corect', () => {
    expect(verificăCss(arboreCorect())).toEqual([])
  })

  it('oprește un al treilea CSS importat din intrare', () => {
    const fișiere = arboreCorect()
    fișiere[0].conținut += "import './app/AppShell.css'\n"
    const abateri = verificăCss(fișiere)
    expect(abateri.some((a) => a.cale === 'src/main.tsx')).toBe(true)
  })

  it('oprește un CSS pe care nu-l importă nimeni', () => {
    const fișiere = [
      ...arboreCorect(),
      { cale: 'src/app/Orfan.css', conținut: '.orfan {}\n' },
    ]
    const abateri = verificăCss(fișiere)
    expect(abateri).toContainEqual({
      cale: 'src/app/Orfan.css',
      motiv: 'nu e importat de niciun .tsx din directorul lui',
    })
  })

  it('oprește un CSS importat de două fișiere din același director', () => {
    const fișiere = [
      ...arboreCorect(),
      { cale: 'src/app/Alt.tsx', conținut: "import './AppShell.css'\n" },
    ]
    const abateri = verificăCss(fișiere)
    expect(
      abateri.some(
        (a) => a.cale === 'src/app/AppShell.css' && a.motiv.includes('2 fișiere'),
      ),
    ).toBe(true)
  })

  it('oprește un CSS importat din alt director', () => {
    const fișiere = arboreCorect()
    fișiere.push({
      cale: 'src/screens/azi/AziScreen.tsx',
      conținut: "import '../../app/AppShell.css'\n",
    })
    const abateri = verificăCss(fișiere)
    expect(
      abateri.some(
        (a) =>
          a.cale === 'src/app/AppShell.css' &&
          a.motiv.startsWith('importat din alt director'),
      ),
    ).toBe(true)
  })

  it('oprește un import către un CSS care nu există', () => {
    const fișiere = arboreCorect()
    fișiere.push({
      cale: 'src/screens/azi/AziScreen.tsx',
      conținut: "import './Lipsă.css'\n",
    })
    const abateri = verificăCss(fișiere)
    expect(
      abateri.some((a) => a.cale === 'src/screens/azi/AziScreen.tsx'),
    ).toBe(true)
  })

  it('oprește lipsa intrării', () => {
    const fișiere = arboreCorect().filter((f) => f.cale !== 'src/main.tsx')
    expect(verificăCss(fișiere)).toContainEqual({
      cale: 'src/main.tsx',
      motiv: 'lipsește intrarea aplicației',
    })
  })

  it('oprește lipsa unui CSS global', () => {
    const fișiere = arboreCorect().filter(
      (f) => f.cale !== 'src/styles/reset.css',
    )
    expect(
      verificăCss(fișiere).some((a) => a.cale === 'src/styles/reset.css'),
    ).toBe(true)
  })
})

describe('verifică', () => {
  it('nu trece verde pe un arbore gol', () => {
    expect(verifică([])).toHaveLength(1)
  })
})

describe('citeșteArbore', () => {
  it('coboară în foldere pe care nu le cunoaște nimeni', () => {
    const rădăcină = mkdtempSync(path.join(tmpdir(), 'structura-'))
    mkdirSync(path.join(rădăcină, 'modul/nou/adânc'), { recursive: true })
    writeFileSync(path.join(rădăcină, 'sus.ts'), 'a\n')
    writeFileSync(path.join(rădăcină, 'modul/nou/adânc/jos.tsx'), 'b\n')

    const fișiere = citeșteArbore(rădăcină)
    const căi = fișiere.map((f) => f.cale.slice(rădăcină.length + 1))

    expect(căi).toEqual(['modul/nou/adânc/jos.tsx', 'sus.ts'])
    expect(fișiere[0].conținut).toBe('b\n')
  })
})
