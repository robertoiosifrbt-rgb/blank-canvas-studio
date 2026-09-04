/*
 * Aplicația, deschisă într-un browser adevărat, la dimensiunea unui telefon,
 * cu așezarea măsurată — nu privită.
 *
 * `npm test` verifică logica, `npm run build` verifică tipurile, dar niciunul
 * n-a prins vreodată un titlu negru pe negru sau o fereastră de dialog
 * așezată pe orizontală. Alea s-au văzut abia pe telefonul lui Roberto, adică
 * prea târziu.
 *
 * Nu măsoară frumusețea. Măsoară lucrurile care fac un ecran inutilizabil:
 * text de culoarea fundalului, elemente ieșite din ecran, o fereastră cu
 * titlul sub câmpuri.
 *
 * Cum se rulează:
 *   npm run build
 *   npm install --no-save playwright
 *   node scripts/layout-check.mjs
 *
 * Playwright nu e în `package.json` intenționat: ar trage browsere la
 * fiecare instalare, inclusiv pe Vercel, unde n-are ce căuta.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }

const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0]))
  const file = existsSync(path) && extname(path) ? path : join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'text/plain' })
  res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}/`

/* Browserul instalat în mediu, dacă e; altfel cel adus de Playwright. */
const found = existsSync('/opt/pw-browsers')
  ? readdirSync('/opt/pw-browsers').find(name => name.startsWith('chromium-'))
  : undefined
const browser = await chromium.launch(found
  ? { executablePath: `/opt/pw-browsers/${found}/chrome-linux/chrome` }
  : {})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const problems = []
/* Fonturile Google sunt blocate în sandbox-ul ăsta; nu e o problemă a
   aplicației, iar raportată ar ascunde ce contează. */
const noise = (text) => /ERR_CONNECTION_RESET|fonts\.googleapis|gstatic/.test(text)
page.on('console', m => { if (m.type() === 'error' && !noise(m.text())) problems.push(`consolă: ${m.text()}`) })
page.on('pageerror', e => problems.push(`eroare: ${e.message}`))

/* Fără rețea: sincronizarea ar încerca Supabase, care de aici e blocat. */
await page.route('**/functions/v1/**', route => route.fulfill({ status: 200, body: '{}' }))
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

const box = async (sel) => page.locator(sel).first().boundingBox()

// 1. Bara de jos există și e jos
const nav = await box('.os-rail')
if (!nav) problems.push('bara de navigare lipsește')
else if (nav.y + nav.height < 700) problems.push(`bara de navigare nu e jos (y=${Math.round(nav.y)})`)

// 2. Titlul ecranului se citește
const title = page.locator('.os-head h1').first()
const seen = await title.evaluate(el => {
  const s = getComputedStyle(el)
  const bg = getComputedStyle(document.querySelector('.os-shell')).backgroundColor
  return { color: s.color, bg }
})
if (seen.color === seen.bg) problems.push(`titlul are culoarea fundalului (${seen.color})`)

// 3. Fereastra de dialog: cap deasupra corpului, butoane dedesubt
/* Pe telefon, bara de jos are doar scurtăturile; restul se ajunge prin
   „Mai mult". Verificarea trece pe același drum ca degetul. */
await page.locator('.os-nav button', { hasText: 'Mai mult' }).first().click()
await page.waitForTimeout(300)
await page.locator('.os-sheet-i', { hasText: 'Datorii' }).first().click()
await page.waitForTimeout(400)
await page.locator('.os-btn', { hasText: 'Datorie nouă' }).first().click()
await page.waitForTimeout(400)
const head = await box('.os-modal header')
const body = await box('.os-modal .body')
const foot = await box('.os-modal footer')
if (!head || !body || !foot) problems.push('fereastra de dialog nu s-a deschis')
else {
  if (head.y >= body.y) problems.push(`titlul ferestrei e sub câmpuri (${Math.round(head.y)} ≥ ${Math.round(body.y)})`)
  if (foot.y <= body.y) problems.push('butoanele ferestrei sunt deasupra câmpurilor')
  if (head.width < 200) problems.push(`capul ferestrei e îngust (${Math.round(head.width)}px)`)
}

// 4. Nimic nu iese lateral din ecran
const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
if (wide) problems.push('pagina se poate trage lateral')

await browser.close()
server.close()
console.log(problems.length ? problems.map(p => `✗ ${p}`).join('\n') : '✓ toate verificările au trecut')
process.exit(problems.length ? 1 : 0)
