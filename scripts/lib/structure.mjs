import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import posix from 'node:path/posix'

/** One file, one responsibility. */
export const LINE_LIMIT = 300

/** The root of the code. The checker never receives a list of folders. */
export const ROOT = 'src'

/** The only file allowed to import global CSS. */
export const ENTRY = 'src/main.tsx'

/** The only two CSS files the entry is allowed to import. */
export const ENTRY_CSS = ['src/styles/tokens.css', 'src/styles/reset.css']

const CODE_EXTENSIONS = ['.ts', '.tsx']

/**
 * Walks everything under the root, recursively, and returns every file found.
 * If a new folder appears it is covered automatically — which is why there is
 * no list of folders to maintain.
 */
export function readTree(root, io = { readdirSync, readFileSync }) {
  const files = []

  const descend = (dir) => {
    for (const entry of io.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        descend(full)
      } else if (entry.isFile()) {
        files.push({
          path: full.split(path.sep).join('/'),
          contents: io.readFileSync(full, 'utf8'),
        })
      }
    }
  }

  descend(root)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** The number of lines, without counting a trailing blank line as a line. */
export function countLines(contents) {
  const lines = contents.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.length
}

/** Every import and re-export specifier in a file. */
export function importsOf(contents) {
  const found = []
  const pattern = /\b(?:import|export)\b[^'";]*?['"]([^'"]+)['"]/g
  let match
  while ((match = pattern.exec(contents)) !== null) {
    found.push(match[1])
  }
  return found
}

/** A relative specifier, resolved to a path from the repository root. */
export function resolveImport(importerPath, specifier) {
  if (!specifier.startsWith('.')) return null
  return posix.normalize(posix.join(posix.dirname(importerPath), specifier))
}

export function checkLineLimits(files) {
  return files
    .filter((file) => CODE_EXTENSIONS.includes(posix.extname(file.path)))
    .map((file) => ({ path: file.path, lines: countLines(file.contents) }))
    .filter((file) => file.lines > LINE_LIMIT)
    .map((file) => ({
      path: file.path,
      reason: `${file.lines} lines, the limit is ${LINE_LIMIT}`,
    }))
}

export function checkCssConvention(files) {
  const problems = []
  const cssFiles = files.filter((file) => posix.extname(file.path) === '.css')
  const tsxFiles = files.filter((file) => posix.extname(file.path) === '.tsx')

  // Who imports what.
  const importers = new Map(cssFiles.map((file) => [file.path, []]))
  for (const tsx of tsxFiles) {
    for (const specifier of importsOf(tsx.contents)) {
      if (!specifier.endsWith('.css')) continue
      const target = resolveImport(tsx.path, specifier)
      if (target === null || !importers.has(target)) {
        problems.push({
          path: tsx.path,
          reason: `imports a CSS file that does not exist under ${ROOT}/: ${specifier}`,
        })
        continue
      }
      importers.get(target).push(tsx.path)
    }
  }

  // The entry rule: only the two global files.
  const entry = files.find((file) => file.path === ENTRY)
  if (!entry) {
    problems.push({ path: ENTRY, reason: 'the application entry is missing' })
  } else {
    for (const specifier of importsOf(entry.contents)) {
      if (!specifier.endsWith('.css')) continue
      const target = resolveImport(ENTRY, specifier)
      if (target === null || !ENTRY_CSS.includes(target)) {
        problems.push({
          path: ENTRY,
          reason:
            `imports ${specifier}. The entry may import only ` +
            ENTRY_CSS.join(' and '),
        })
      }
    }
    for (const global of ENTRY_CSS) {
      if (!importers.has(global)) {
        problems.push({ path: global, reason: 'the global CSS file is missing' })
      }
    }
  }

  // The rule for every other file: exactly one .tsx in the same directory.
  for (const css of cssFiles) {
    if (ENTRY_CSS.includes(css.path)) continue
    const here = importers.get(css.path)
    const sameDirectory = here.filter(
      (importer) => posix.dirname(importer) === posix.dirname(css.path),
    )
    const elsewhere = here.filter(
      (importer) => posix.dirname(importer) !== posix.dirname(css.path),
    )

    if (elsewhere.length > 0) {
      problems.push({
        path: css.path,
        reason: `imported from another directory: ${elsewhere.join(', ')}`,
      })
    }
    if (sameDirectory.length !== 1) {
      problems.push({
        path: css.path,
        reason:
          sameDirectory.length === 0
            ? 'not imported by any .tsx in its own directory'
            : `imported by ${sameDirectory.length} files in its own directory: ${sameDirectory.join(', ')}`,
      })
    }
  }

  return problems
}

/** Every structure check, over the same file tree. */
export function check(files) {
  if (files.length === 0) {
    return [{ path: ROOT, reason: 'no files were found' }]
  }
  return [...checkLineLimits(files), ...checkCssConvention(files)]
}
