#!/usr/bin/env node
// The structure checks, run in CI after the build.
// It starts at the root of the code and sees everything. It receives no
// folders.

import { check, readTree, ROOT } from './lib/structure.mjs'

const files = readTree(ROOT)
const problems = check(files)

if (problems.length === 0) {
  console.log(`Structure is fine: ${files.length} files checked from the repository root`)
  process.exit(0)
}

console.error(`Structure: ${problems.length} problems\n`)
for (const problem of problems) {
  console.error(`  ${problem.path}: ${problem.reason}`)
}
process.exit(1)
