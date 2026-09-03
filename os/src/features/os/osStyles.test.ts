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
