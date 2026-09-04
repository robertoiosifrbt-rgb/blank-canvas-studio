#!/usr/bin/env node
// Pornește aplicația la lățime de telefon și cade dacă ceva iese din ecran,
// dacă un text stă sub bara de status sau dacă o zonă apăsabilă e prea mică.
//
// La final se verifică singur, cu patru elemente stricate intenționat. Un
// verificator care nu poate demonstra că prinde o greșeală e o verificare
// verde care nu verifică nimic.

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

import {
  APĂSABILE,
  cssSiguranță,
  inspectează,
  LĂȚIMI,
  SIGURANȚĂ,
  ZONA_MINIMĂ,
} from './lib/layout.mjs'

const PORT = Number(process.env.PORT_VERIFICARE ?? 4319)
const BAZA = `http://127.0.0.1:${PORT}`
const CĂI = ['/azi', '/calendar', '/', '/o-cale-care-nu-există']
const ARGUMENTE = {
  zonaMinimă: ZONA_MINIMĂ,
  siguranță: SIGURANȚĂ,
  apăsabile: APĂSABILE,
}

async function așteaptăServerul(încercări = 60) {
  for (let i = 0; i < încercări; i += 1) {
    try {
      const răspuns = await fetch(BAZA)
      if (răspuns.ok) return
    } catch {
      // serverul nu s-a ridicat încă
    }
    await new Promise((gata) => setTimeout(gata, 250))
  }
  throw new Error(`Serverul nu a răspuns la ${BAZA}`)
}

function porneșteServerul() {
  const proces = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  proces.stderr.on('data', (bucată) => process.stderr.write(bucată))
  return proces
}

/** Deschide o cale, simulează marginile telefonului, întoarce ce a găsit. */
async function inspecteazăCalea(pagină, cale, dimensiune) {
  await pagină.setViewportSize({
    width: dimensiune.lățime,
    height: dimensiune.înălțime,
  })
  await pagină.goto(`${BAZA}${cale}`, { waitUntil: 'networkidle' })
  await pagină.addStyleTag({ content: cssSiguranță() })
  return pagină.evaluate(inspectează, ARGUMENTE)
}

const abateri = []
const server = porneșteServerul()
let browser

try {
  await așteaptăServerul()
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  })
  const pagină = await browser.newPage()

  for (const dimensiune of LĂȚIMI) {
    for (const cale of CĂI) {
      const { abateri: găsite, numărate } = await inspecteazăCalea(
        pagină,
        cale,
        dimensiune,
      )
      const unde = `${cale} @ ${dimensiune.lățime}px`

      if (numărate.text === 0) {
        abateri.push({ unde, fel: 'gol', element: '-', detaliu: 'niciun text pe ecran' })
      }
      if (numărate.apăsabile === 0) {
        abateri.push({
          unde,
          fel: 'gol',
          element: '-',
          detaliu: 'nicio zonă apăsabilă pe ecran',
        })
      }
      for (const abatere of găsite) abateri.push({ unde, ...abatere })
      console.log(
        `  ${unde}: ${găsite.length} abateri, ${numărate.text} texte, ${numărate.apăsabile} zone apăsabile`,
      )
    }
  }

  // Auto-verificare: trei greșeli puse anume, care trebuie prinse toate trei.
  await pagină.setViewportSize({ width: 320, height: 568 })
  await pagină.goto(`${BAZA}/azi`, { waitUntil: 'networkidle' })
  await pagină.addStyleTag({ content: cssSiguranță() })
  await pagină.evaluate(() => {
    const strică = document.createElement('div')
    strică.id = 'canar'
    strică.innerHTML =
      '<div id="canar-lat" style="position:fixed;top:200px;left:0;width:200vw;height:4px"></div>' +
      '<p id="canar-text" style="position:fixed;top:0;left:0;margin:0">sub bară</p>' +
      '<button id="canar-buton" style="position:fixed;top:100px;left:0;width:10px;height:10px">x</button>' +
      '<button id="canar-jos" style="position:fixed;bottom:0;left:0;width:44px;height:44px">j</button>'
    document.body.append(strică)
  })
  const { abateri: prinse } = await pagină.evaluate(inspectează, ARGUMENTE)
  const feluri = new Set(prinse.map((a) => a.fel))
  for (const fel of ['ieșit', 'sub-bară', 'prea-mic', 'sub-indicator']) {
    if (!feluri.has(fel)) {
      abateri.push({
        unde: 'auto-verificare',
        fel: 'orb',
        element: fel,
        detaliu: `verificatorul nu a prins o greșeală de tip "${fel}"`,
      })
    }
  }
  console.log(`  auto-verificare: a prins ${[...feluri].join(', ')}`)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

if (abateri.length === 0) {
  console.log('\nAșezare în regulă la lățime de telefon.')
  process.exit(0)
}

console.error(`\nAșezare: ${abateri.length} abateri\n`)
for (const abatere of abateri) {
  console.error(`  [${abatere.fel}] ${abatere.unde} → ${abatere.element}: ${abatere.detaliu}`)
}
process.exit(1)
