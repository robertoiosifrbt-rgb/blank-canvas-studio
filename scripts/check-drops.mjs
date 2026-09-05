#!/usr/bin/env node
// Fails when a migration removes something the code on the deployed branch
// still asks for. See scripts/lib/drops.mjs for the day that cost.

import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { dropsIn, stillAsked } from './lib/drops.mjs'

const BASE = process.env.CHECK_BASE ?? 'origin/main'
const MIGRATIONS = 'supabase/migrations'

/** Every file of the shipped tree, read from git rather than from disk. */
function shippedFiles(ref) {
  const list = spawnSync('git', ['ls-tree', '-r', '--name-only', ref, 'src'], {
    encoding: 'utf8',
  })
  if (list.status !== 0) return null
  return list.stdout
    .split('\n')
    .filter(Boolean)
    .map((path) => {
      const show = spawnSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' })
      return { path, contents: show.status === 0 ? show.stdout : '' }
    })
}

const files = shippedFiles(BASE)
if (files === null) {
  // ⛔ Not a pass. Without the shipped tree there is nothing to compare
  // against, and a check that cannot look must not report that it looked.
  console.error(
    `Cannot read ${BASE}. Fetch it first, or set CHECK_BASE to the branch the\n` +
      'app is built from. This check has nothing to compare against without it.',
  )
  process.exit(1)
}

const problems = []
for (const name of readdirSync(MIGRATIONS).sort()) {
  const sql = readFileSync(`${MIGRATIONS}/${name}`, 'utf8')
  for (const { kind, name: gone } of dropsIn(sql)) {
    const asked = stillAsked(files, gone)
    if (asked.length > 0) {
      problems.push({ migration: name, kind, gone, asked: asked.map((one) => one.path) })
    }
  }
}

if (problems.length === 0) {
  console.log(`Nothing dropped is still asked for by ${BASE}.`)
  process.exit(0)
}

console.error(`Migrations that would break the app running from ${BASE}: ${problems.length}`)
for (const { migration, kind, gone, asked } of problems) {
  console.error(`  ${migration} drops the ${kind} "${gone}", still named in:`)
  for (const path of asked.slice(0, 4)) console.error(`      ${path}`)
}
console.error('\nDeploy the code first, then run the SQL. The other way round is an')
console.error('app that stops working between the two.')
process.exit(1)
