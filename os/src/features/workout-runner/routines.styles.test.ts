import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * `routines.css` cerea `var(--surface)`, `var(--border)` și `var(--text-muted)`
 * — nume care nu există nicăieri în aplicație. Fiecare cădea pe rezerva scrisă
 * în paranteză, deci cardurile rămâneau albe indiferent de temă, iar numele
 * planului, moștenind albul ecranului de rulare, ieșea alb pe alb.
 *
 * O variabilă greșită nu e o eroare pentru browser: pur și simplu folosește
 * rezerva. De aia n-a semnalat nimic, nici build, nici teste.
 */

function filesUnder(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(path, match)
    return match(entry.name) ? [path] : []
  })
}

const cssFiles = (dir: string) => filesUnder(dir, name => name.endsWith('.css'))

/**
 * Tot ce e definit undeva: în foile de stil, sau pus din cod pe element —
 * adâncimea unui modul în bară, numărul de coloane al rulării. Pe astea
 * browserul le are la randare, chiar dacă nu scrie nicăieri în CSS.
 */
function declaredTokens(): Set<string> {
  const declared = new Set<string>()
  for (const file of [...cssFiles('src'), ...filesUnder('src', name => name.endsWith('.tsx'))]) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(--[\w-]+)\s*(?:'|")?\s*(?:as string)?\s*(?:'|")?\s*\]?\s*:/g)) {
      declared.add(match[1])
    }
  }
  return declared
}

describe('variabilele de culoare folosite de aplicația de sală', () => {
  const declared = declaredTokens()

  it.each(cssFiles('src/features'))('%s cere numai variabile care există', file => {
    const css = readFileSync(file, 'utf8')
    const used = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1])
    /* `--os-*` sunt ale gazdei, declarate în stilurile Roberto OS. */
    const unknown = [...new Set(used)].filter(name => !declared.has(name) && !name.startsWith('--os-'))
    expect(unknown).toEqual([])
  })
})
