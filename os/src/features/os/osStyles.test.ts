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
