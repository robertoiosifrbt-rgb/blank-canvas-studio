#!/usr/bin/env node
// Verificările de structură, rulate în CI după build.
// Pornește de la rădăcina codului și vede tot. Nu primește foldere.

import { citeșteArbore, RĂDĂCINA, verifică } from './lib/structure.mjs'

const fișiere = citeșteArbore(RĂDĂCINA)
const abateri = verifică(fișiere)

if (abateri.length === 0) {
  console.log(
    `Structură în regulă: ${fișiere.length} fișiere verificate sub ${RĂDĂCINA}/`,
  )
  process.exit(0)
}

console.error(`Structură: ${abateri.length} abateri\n`)
for (const abatere of abateri) {
  console.error(`  ${abatere.cale}: ${abatere.motiv}`)
}
process.exit(1)
