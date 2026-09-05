#!/usr/bin/env node
// Fails when a screen has a URL and no way in. See scripts/lib/reachable.mjs
// for the day that cost.

import { readTree } from './lib/structure.mjs'
import { unreachable } from './lib/reachable.mjs'

const files = readTree('.')
const problems = unreachable(files)

if (problems.length === 0) {
  const count = files.filter((one) => /\.tsx$/.test(one.path)).length
  console.log(`Every screen has a door: ${count} files read.`)
  process.exit(0)
}

console.error(`Screens with no way in: ${problems.length}`)
for (const { path, why } of problems) console.error(`  ${path}: ${why}`)
process.exit(1)
