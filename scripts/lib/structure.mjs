import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import posix from 'node:path/posix'

/** Un fișier, o responsabilitate. */
export const LIMITA_LINII = 300

/** Rădăcina codului. Verificatorul nu primește niciodată o listă de foldere. */
export const RĂDĂCINA = 'src'

/** Singurul fișier care are voie să importe CSS global. */
export const INTRARE = 'src/main.tsx'

/** Singurele două fișiere CSS pe care intrarea are voie să le importe. */
export const CSS_DE_INTRARE = ['src/styles/tokens.css', 'src/styles/reset.css']

const EXTENSII_COD = ['.ts', '.tsx']

/**
 * Parcurge recursiv tot ce e sub rădăcină și întoarce fiecare fișier găsit.
 * Dacă apare un folder nou, e acoperit automat — de-aia nu există nicio listă
 * de foldere de întreținut.
 */
export function citeșteArbore(rădăcină, io = { readdirSync, readFileSync }) {
  const fișiere = []

  const coboară = (dir) => {
    const intrări = io.readdirSync(dir, { withFileTypes: true })
    for (const intrare of intrări) {
      const cale = path.join(dir, intrare.name)
      if (intrare.isDirectory()) {
        coboară(cale)
      } else if (intrare.isFile()) {
        fișiere.push({
          cale: cale.split(path.sep).join('/'),
          conținut: io.readFileSync(cale, 'utf8'),
        })
      }
    }
  }

  coboară(rădăcină)
  return fișiere.sort((a, b) => a.cale.localeCompare(b.cale))
}

/** Numărul de linii, fără să numere linia goală de la final ca linie. */
export function numărăLinii(conținut) {
  const linii = conținut.split('\n')
  if (linii.length > 0 && linii[linii.length - 1] === '') linii.pop()
  return linii.length
}

/** Toate specificatoarele de import și de re-export dintr-un fișier. */
export function extrageImporturi(conținut) {
  const găsite = []
  const regex = /\b(?:import|export)\b[^'";]*?['"]([^'"]+)['"]/g
  let potrivire
  while ((potrivire = regex.exec(conținut)) !== null) {
    găsite.push(potrivire[1])
  }
  return găsite
}

/** Specificatorul relativ, rezolvat în cale de la rădăcina repo-ului. */
export function rezolvăImport(caleaImportatorului, specificator) {
  if (!specificator.startsWith('.')) return null
  return posix.normalize(
    posix.join(posix.dirname(caleaImportatorului), specificator),
  )
}

export function verificăLinii(fișiere) {
  return fișiere
    .filter((f) => EXTENSII_COD.includes(posix.extname(f.cale)))
    .map((f) => ({ cale: f.cale, linii: numărăLinii(f.conținut) }))
    .filter((f) => f.linii > LIMITA_LINII)
    .map((f) => ({
      cale: f.cale,
      motiv: `${f.linii} linii, limita e ${LIMITA_LINII}`,
    }))
}

export function verificăCss(fișiere) {
  const abateri = []
  const fișiereCss = fișiere.filter((f) => posix.extname(f.cale) === '.css')
  const fișiereTsx = fișiere.filter((f) => posix.extname(f.cale) === '.tsx')

  // Cine importă ce.
  const importatori = new Map(fișiereCss.map((f) => [f.cale, []]))
  for (const tsx of fișiereTsx) {
    for (const specificator of extrageImporturi(tsx.conținut)) {
      if (!specificator.endsWith('.css')) continue
      const țintă = rezolvăImport(tsx.cale, specificator)
      if (țintă === null || !importatori.has(țintă)) {
        abateri.push({
          cale: tsx.cale,
          motiv: `importă un CSS care nu există sub ${RĂDĂCINA}/: ${specificator}`,
        })
        continue
      }
      importatori.get(țintă).push(tsx.cale)
    }
  }

  // Regula intrării: numai cele două fișiere globale.
  const intrare = fișiere.find((f) => f.cale === INTRARE)
  if (!intrare) {
    abateri.push({ cale: INTRARE, motiv: 'lipsește intrarea aplicației' })
  } else {
    for (const specificator of extrageImporturi(intrare.conținut)) {
      if (!specificator.endsWith('.css')) continue
      const țintă = rezolvăImport(INTRARE, specificator)
      if (țintă === null || !CSS_DE_INTRARE.includes(țintă)) {
        abateri.push({
          cale: INTRARE,
          motiv:
            `importă ${specificator}. Din intrare se pot importa numai ` +
            CSS_DE_INTRARE.join(' și '),
        })
      }
    }
    for (const global of CSS_DE_INTRARE) {
      if (!importatori.has(global)) {
        abateri.push({ cale: global, motiv: 'lipsește fișierul CSS global' })
      }
    }
  }

  // Regula celorlalte: exact un .tsx din același director.
  for (const css of fișiereCss) {
    if (CSS_DE_INTRARE.includes(css.cale)) continue
    const aiciSunt = importatori.get(css.cale)
    const dinAcelașiDirector = aiciSunt.filter(
      (importator) => posix.dirname(importator) === posix.dirname(css.cale),
    )
    const dinAltParte = aiciSunt.filter(
      (importator) => posix.dirname(importator) !== posix.dirname(css.cale),
    )

    if (dinAltParte.length > 0) {
      abateri.push({
        cale: css.cale,
        motiv: `importat din alt director: ${dinAltParte.join(', ')}`,
      })
    }
    if (dinAcelașiDirector.length !== 1) {
      abateri.push({
        cale: css.cale,
        motiv:
          dinAcelașiDirector.length === 0
            ? 'nu e importat de niciun .tsx din directorul lui'
            : `importat de ${dinAcelașiDirector.length} fișiere din directorul lui: ${dinAcelașiDirector.join(', ')}`,
      })
    }
  }

  return abateri
}

/** Toate verificările de structură, pe același arbore de fișiere. */
export function verifică(fișiere) {
  if (fișiere.length === 0) {
    return [{ cale: RĂDĂCINA, motiv: 'nu s-a găsit niciun fișier' }]
  }
  return [...verificăLinii(fișiere), ...verificăCss(fișiere)]
}
