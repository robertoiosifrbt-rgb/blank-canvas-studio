import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Aplicația de sală stilează elemente (h1, form, input, button[type=…]), nu
   clase. De când OS-ul o găzduiește, regulile ei ar cădea peste ecranele
   OS-ului și le-ar bate la specificitate — titlurile OS-ului deveneau negru
   pe negru. Le ținem într-un strat de cascadă propriu. Dacă cineva pune la
   loc importurile directe în main.tsx, ecranele se strică din nou fără
   niciun semn, așa că regula stă scrisă aici. */

const main = readFileSync('src/main.tsx', 'utf8')
const wrapper = readFileSync('src/gymStyles.css', 'utf8')

const GLOBALS = [
  './styles/tokens.css',
  './index.css',
  './redesign.css',
  './target-shell.css',
  './workout-target.css',
  './progress-target.css',
  './styles/viewportStability.css',
]

describe('stilurile globale ale aplicației de sală', () => {
  it('intră în aplicație doar prin fișierul care le stratifică', () => {
    expect(main).toContain("import './gymStyles.css'")
    for (const file of GLOBALS) expect(main).not.toContain(`import '${file}'`)
  })

  it('sunt toate puse în stratul gym', () => {
    for (const file of GLOBALS) {
      expect(wrapper).toContain(`@import '${file}' layer(gym);`)
    }
  })

  it('nu lasă stilurile OS-ului în vreun strat, ca să rămână deasupra', () => {
    for (const file of ['osTokens.css', 'osLayout.css', 'osComponents.css', 'osScreens.css']) {
      expect(readFileSync(`src/features/os/${file}`, 'utf8')).not.toContain('@layer')
    }
  })
})

/* Aplicația de sală e randată în interiorul `.os-shell`, deci orice regulă
   scrisă ca `.os-shell <element>` cade și peste ea. Așa a ajuns un checkbox
   al sălii lat cât rândul: `.os-shell input{width:100%}`. Regulile OS-ului se
   scriu pe clasele lui. */
describe('stilurile OS-ului nu ies din OS', () => {
  const SHEETS = ['osTokens.css', 'osLayout.css', 'osComponents.css', 'osScreens.css', 'osGym.css']
  const LEAK = /\.os-shell\s+[a-z]/

  it.each(SHEETS)('%s nu stilează elemente prin `.os-shell`', file => {
    const css = readFileSync(`src/features/os/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const offenders = css.split('\n').filter(line => LEAK.test(line.split('{')[0]))
    expect(offenders).toEqual([])
  })
})

/* Aplicația de sală declară `h1,h2,h3{color:…}` pe element. Stratul o coboară
   în cascadă, dar straturile decid doar între declarații pentru aceeași
   proprietate: o declarație directă bate oricând o culoare moștenită de la
   părinte, oricât de jos ar fi stratul ei. Așa a rămas titlul „Azi" negru pe
   negru și după ce credeam că e reparat. Deci fiecare titlu al OS-ului își
   spune culoarea. */
describe('titlurile OS-ului', () => {
  const SHEETS = ['osLayout.css', 'osComponents.css', 'osScreens.css']

  /* Un titlu poate avea mai multe reguli — una de bază și una pentru telefon,
     care schimbă doar mărimea. Se cere o culoare pe undeva, nu în fiecare. */
  it.each(SHEETS)('%s dă o culoare fiecărui titlu', file => {
    const css = readFileSync(`src/features/os/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const coloured = new Map<string, boolean>()
    for (const [, selector, block] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const name = selector.trim()
      if (!/\bh[1-3]\s*$/.test(name)) continue
      coloured.set(name, (coloured.get(name) ?? false) || /(^|;)\s*color\s*:/.test(block))
    }
    expect([...coloured].filter(([, has]) => !has).map(([name]) => name)).toEqual([])
  })
})

/* Straturile decid între declarații pentru aceeași proprietate. O proprietate
   pe care OS-ul n-o declară deloc nu e o competiție — se aplică ce spune
   stratul de jos. Așa a ajuns titlul „Azi" negru pe negru, și tot așa a ajuns
   fereastra de dialog așezată pe orizontală: e un `<form>`, iar aplicația de
   sală dă `form{display:flex;flex-wrap:wrap;align-items:end}`.

   Deci, pentru fiecare element pe care sala îl stilează și OS-ul îl
   folosește, OS-ul își spune singur proprietățile. */
describe('elementele pe care le stilează și sala', () => {
  const css = readFileSync('src/features/os/osScreens.css', 'utf8')
  const rule = (selector: string): string =>
    css.split('\n').join(' ').match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

  it('fereastra de dialog își declară aranjarea, fiind un <form>', () => {
    const modal = rule('.os-modal')
    for (const property of ['display', 'flex-direction', 'flex-wrap', 'align-items', 'gap', 'margin']) {
      expect(modal).toContain(`${property}:`)
    }
  })
})
