/**
 * Every screen has a URL. This asks the other half: can anybody get to it?
 *
 * 🔴 **Măsurat în ziua în care s-a scris:** ecranul HMRC avea rută, ecran,
 * teste și o poză trimisă proprietarului — și **nicio ușă**. Singurul link
 * pornea de sub blocul lunii din Calendar, iar blocul acela nu se desenează
 * deloc într-o lună fără muncă în ea. Deci pentru un an nou, sau unul liniștit,
 * ecranul care decide ce înseamnă fiecare cifră din aplicație nu exista.
 *
 * ⛔ Nicio verificare de dinainte nu putea prinde asta: `typecheck` vede ruta,
 * testele văd componenta, `build` le împachetează pe amândouă. Toate trec, și
 * ecranul e de neatins.
 *
 * ⚠️ Un ecran din bara de jos e găsit prin bară. Unul din afara ei are nevoie
 * de un link către el, scris altundeva decât în fișierul care declară rutele —
 * altfel lista se trimite pe ea însăși și poarta trece degeaba.
 */

/** Where the screens are declared: paths in, and nothing else. */
export const SCREENS_FILE = 'src/app/screens.tsx'

/** Every `path: '…'` in the screens file, with the list it belongs to. */
export function routesOf(contents) {
  const routes = []
  // The two lists in order, so a path is attributed to the one above it.
  const lists = [...contents.matchAll(/export const (\w+): readonly Screen\[\]/g)]
  for (const match of contents.matchAll(/path:\s*'([^']+)'/g)) {
    const at = match.index ?? 0
    let list = 'SCREENS'
    for (const start of lists) {
      if ((start.index ?? 0) < at) list = start[1]
    }
    routes.push({ path: match[1], list })
  }
  return routes
}

/**
 * The part of a path that a link must contain.
 *
 * `/areas/:id` is linked as `` to={`/areas/${area.id}`} ``, so the static head
 * is what can be looked for. A path that is nothing but a parameter has no
 * head, and is reported rather than passed.
 */
export function headOf(path) {
  const head = path.split(':')[0]
  return head === '/' ? '/' : head.replace(/\/$/, '') || null
}

/** Whether any file other than the declaration links to this head. */
export function linkedFrom(files, head) {
  const found = []
  for (const { path: file, contents } of files) {
    if (file === SCREENS_FILE) continue
    if (!/\.tsx?$/.test(file)) continue
    // A link, a redirect, or a programmatic navigation. All three are doors.
    const patterns = [
      new RegExp(`to=(?:"|'|\\{\`)${head}(?![\\w-])`),
      new RegExp(`navigate\\((?:'|"|\`)${head}(?![\\w-])`),
      new RegExp(`Navigate[^>]*to=(?:"|'|\\{\`)${head}(?![\\w-])`),
    ]
    if (patterns.some((one) => one.test(contents))) found.push(file)
  }
  return found
}

/** The screens nobody can reach, with the reason each one is unreachable. */
export function unreachable(files) {
  const declaration = files.find((one) => one.path === SCREENS_FILE)?.contents
  if (declaration === undefined) {
    return [{ path: SCREENS_FILE, why: 'the screens are not declared where this looks' }]
  }

  const problems = []
  for (const { path, list } of routesOf(declaration)) {
    // The bar is a door: it draws a link for every screen in that list.
    if (list === 'SCREENS') continue
    const head = headOf(path)
    if (head === null) {
      problems.push({ path, why: 'nothing but a parameter, so no link can name it' })
      continue
    }
    if (linkedFrom(files, head).length === 0) {
      problems.push({ path, why: `no link, redirect or navigate reaches ${head}` })
    }
  }
  return problems
}
