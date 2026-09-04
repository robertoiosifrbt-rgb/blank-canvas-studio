import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  check,
  checkCssConvention,
  checkLineLimits,
  countLines,
  importsOf,
  LINE_LIMIT,
  readTree,
  resolveImport,
} from './structure.mjs'

/** A minimal, correct tree the checker must stay quiet about. */
function goodTree() {
  return [
    {
      path: 'src/main.tsx',
      contents: "import './styles/tokens.css'\nimport './styles/reset.css'\n",
    },
    { path: 'src/styles/tokens.css', contents: ':root { color: red }\n' },
    { path: 'src/styles/reset.css', contents: 'body { margin: 0 }\n' },
    { path: 'src/app/AppShell.tsx', contents: "import './AppShell.css'\n" },
    { path: 'src/app/AppShell.css', contents: '.shell {}\n' },
  ]
}

describe('countLines', () => {
  it('does not count the trailing blank line as a line', () => {
    expect(countLines('a\nb\n')).toBe(2)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines('')).toBe(0)
  })
})

describe('checkLineLimits', () => {
  it('lets exactly the limit through and stops one line over', () => {
    const atLimit = `${'x\n'.repeat(LINE_LIMIT)}`
    const overLimit = `${'x\n'.repeat(LINE_LIMIT + 1)}`

    expect(checkLineLimits([{ path: 'src/a.ts', contents: atLimit }])).toEqual([])
    expect(checkLineLimits([{ path: 'src/a.ts', contents: overLimit }])).toHaveLength(1)
  })

  it('applies to .ts and .tsx, not to anything else', () => {
    const tooMany = `${'x\n'.repeat(LINE_LIMIT + 1)}`
    expect(checkLineLimits([{ path: 'src/a.tsx', contents: tooMany }])).toHaveLength(1)
    expect(checkLineLimits([{ path: 'src/a.css', contents: tooMany }])).toEqual([])
    expect(checkLineLimits([{ path: 'src/a.md', contents: tooMany }])).toEqual([])
  })
})

describe('importsOf', () => {
  it('catches every form of import and re-export', () => {
    const code = [
      "import './a.css'",
      "import React from 'react'",
      "import type { X } from './x'",
      "import { a, b } from '../b'",
      "export * from './c'",
      "export { d } from './d'",
      "const e = await import('./e')",
    ].join('\n')

    expect(importsOf(code)).toEqual([
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

describe('resolveImport', () => {
  it('resolves relative to the importer directory', () => {
    expect(resolveImport('src/main.tsx', './styles/tokens.css')).toBe(
      'src/styles/tokens.css',
    )
    expect(resolveImport('src/ui/Note.tsx', '../styles/tokens.css')).toBe(
      'src/styles/tokens.css',
    )
  })

  it('ignores packages', () => {
    expect(resolveImport('src/main.tsx', 'react')).toBeNull()
  })
})

describe('checkCssConvention', () => {
  it('stays quiet on a correct tree', () => {
    expect(checkCssConvention(goodTree())).toEqual([])
  })

  it('stops a third CSS file imported from the entry', () => {
    const files = goodTree()
    files[0].contents += "import './app/AppShell.css'\n"
    expect(checkCssConvention(files).some((p) => p.path === 'src/main.tsx')).toBe(true)
  })

  it('stops a CSS file nobody imports', () => {
    const files = [...goodTree(), { path: 'src/app/Orphan.css', contents: '.o {}\n' }]
    expect(checkCssConvention(files)).toContainEqual({
      path: 'src/app/Orphan.css',
      reason: 'not imported by any .tsx in its own directory',
    })
  })

  it('stops a CSS file imported by two files in the same directory', () => {
    const files = [
      ...goodTree(),
      { path: 'src/app/Other.tsx', contents: "import './AppShell.css'\n" },
    ]
    expect(
      checkCssConvention(files).some(
        (p) => p.path === 'src/app/AppShell.css' && p.reason.includes('2 files'),
      ),
    ).toBe(true)
  })

  it('stops a CSS file imported from another directory', () => {
    const files = goodTree()
    files.push({
      path: 'src/screens/today/TodayScreen.tsx',
      contents: "import '../../app/AppShell.css'\n",
    })
    expect(
      checkCssConvention(files).some(
        (p) =>
          p.path === 'src/app/AppShell.css' &&
          p.reason.startsWith('imported from another directory'),
      ),
    ).toBe(true)
  })

  it('stops an import of a CSS file that does not exist', () => {
    const files = goodTree()
    files.push({
      path: 'src/screens/today/TodayScreen.tsx',
      contents: "import './Missing.css'\n",
    })
    expect(
      checkCssConvention(files).some(
        (p) => p.path === 'src/screens/today/TodayScreen.tsx',
      ),
    ).toBe(true)
  })

  it('stops a missing entry', () => {
    const files = goodTree().filter((f) => f.path !== 'src/main.tsx')
    expect(checkCssConvention(files)).toContainEqual({
      path: 'src/main.tsx',
      reason: 'the application entry is missing',
    })
  })

  it('stops a missing global CSS file', () => {
    const files = goodTree().filter((f) => f.path !== 'src/styles/reset.css')
    expect(
      checkCssConvention(files).some((p) => p.path === 'src/styles/reset.css'),
    ).toBe(true)
  })
})

describe('check', () => {
  it('does not go green on an empty tree', () => {
    expect(check([])).toHaveLength(1)
  })
})

describe('readTree', () => {
  it('descends into folders nobody told it about', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'structure-'))
    mkdirSync(path.join(root, 'module/new/deep'), { recursive: true })
    writeFileSync(path.join(root, 'top.ts'), 'a\n')
    writeFileSync(path.join(root, 'module/new/deep/bottom.tsx'), 'b\n')

    const files = readTree(root)
    const paths = files.map((f) => f.path.slice(root.length + 1))

    expect(paths).toEqual(['module/new/deep/bottom.tsx', 'top.ts'])
    expect(files[0].contents).toBe('b\n')
  })
})
