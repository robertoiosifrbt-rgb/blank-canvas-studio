#!/usr/bin/env node
// Pornește aplicația la lățime de telefon și cade dacă ceva iese din ecran,
// dacă un text stă sub bara de status sau dacă o zonă apăsabilă e prea mică.
//
// Verifică și ecranul de intrare, și ecranele de după autentificare — deci are
// nevoie de un cont pe Supabase local. Fără el se oprește: un verificator care
// sare în silence peste jumătate din aplicație e o verificare verde care nu
// verifică nimic.
//
// La final se verifică singur, cu patru elemente stricate intenționat.

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
const EMAIL = process.env.VERIFICARE_EMAIL
const PAROLA = process.env.VERIFICARE_PAROLA

if (!EMAIL || !PAROLA) {
  console.error(
    'Lipsesc VERIFICARE_EMAIL și VERIFICARE_PAROLA. Ecranele aplicației stau\n' +
      'după autentificare, deci verificarea are nevoie de un cont pe Supabase\n' +
      'local. Nu se folosesc niciodată credențiale de producție.',
  )
  process.exit(1)
}

/** Ecranul dinaintea contului. */
const CĂI_PUBLICE = ['/intrare']
/** Ecranele de după cont. Ultima nu există: trebuie să aibă ieșire. */
const CĂI_PRIVATE = ['/azi', '/calendar', '/', '/o-cale-care-nu-există']

const ARGUMENTE = {
  zonaMinimă: ZONA_MINIMĂ,
  siguranță: SIGURANȚĂ,
  apăsabile: APĂSABILE,
}

async function așteaptăServerul(încercări = 60) {
  for (let i = 0; i < încercări; i += 1) {
    try {
      if ((await fetch(BAZA)).ok) return
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

/** Deschide o cale și așteaptă un ecran adevărat, nu starea de încărcare. */
async function deschide(pagină, cale) {
  await pagină.goto(`${BAZA}${cale}`, { waitUntil: 'networkidle' })
  await pagină.waitForSelector('.shell, .intrare', { timeout: 15000 })
  await pagină.addStyleTag({ content: cssSiguranță() })
}

async function intrăÎnCont(pagină) {
  await deschide(pagină, '/intrare')
  await pagină.fill('input[name="email"]', EMAIL)
  await pagină.fill('input[name="parola"]', PAROLA)
  await pagină.click('.intrare-buton')
  try {
    await pagină.waitForSelector('.shell', { timeout: 20000 })
  } catch {
    // Dacă formularul a spus de ce, ăla e motivul adevărat.
    const spus = await pagină
      .locator('.intrare-mesaj-eroare')
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(
      `nu s-a putut intra în cont cu ${EMAIL}: ${spus ?? 'ecranul a rămas la intrare'}`,
    )
  }
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

  for (const dimensiune of LĂȚIMI) {
    // Context nou la fiecare lățime: fiecare rundă pleacă fără sesiune salvată.
    const context = await browser.newContext({
      viewport: { width: dimensiune.lățime, height: dimensiune.înălțime },
    })
    const pagină = await context.newPage()

    const căi = [...CĂI_PUBLICE]
    for (const cale of căi) {
      await deschide(pagină, cale)
      adună(await pagină.evaluate(inspectează, ARGUMENTE), cale, dimensiune)
    }

    await intrăÎnCont(pagină)
    for (const cale of CĂI_PRIVATE) {
      await deschide(pagină, cale)
      adună(await pagină.evaluate(inspectează, ARGUMENTE), cale, dimensiune)
    }

    if (dimensiune === LĂȚIMI[0]) await autoVerifică(pagină)
    await context.close()
  }
} catch (motiv) {
  // O cădere a verificatorului e o abatere raportată, nu o urmă de stivă.
  abateri.push({
    unde: 'verificare',
    fel: 'căzut',
    element: '-',
    detaliu: motiv instanceof Error ? motiv.message : String(motiv),
  })
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

function adună({ abateri: găsite, numărate }, cale, dimensiune) {
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

/** Patru greșeli puse anume, care trebuie prinse toate patru. */
async function autoVerifică(pagină) {
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
        detaliu: `verificatorul nu a prins o greșeală de tip „${fel}"`,
      })
    }
  }
  console.log(`  auto-verificare: a prins ${[...feluri].join(', ')}`)
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
