/**
 * Verificarea așezării, la lățime de telefon.
 *
 * typecheck verifică tipurile, testele verifică logica. Niciunul nu prinde un
 * element ieșit din ecran, un text sub bara de status sau un buton prea mic
 * pentru un deget. De-aia asta e un script, nu o intenție.
 */

/** Zona apăsabilă minimă, în pixeli. */
export const ZONA_MINIMĂ = 44

/** Marginile de siguranță simulate: un telefon cu crestătură. */
export const SIGURANȚĂ = { sus: 47, jos: 34 }

/** Lățimile pe care se verifică. 320 e cel mai îngust telefon real. */
export const LĂȚIMI = [
  { lățime: 320, înălțime: 568 },
  { lățime: 390, înălțime: 844 },
]

/** Ce se consideră zonă apăsabilă. */
export const APĂSABILE =
  'a, button, input, select, textarea, [role="button"]'

/**
 * Rulează în pagină. Întoarce abaterile găsite, plus ce a numărat — dacă n-a
 * numărat nimic, verificarea a trecut verde fără să verifice nimic.
 */
export function inspectează({ zonaMinimă, siguranță, apăsabile }) {
  const abateri = []
  const lățime = window.innerWidth
  const înălțime = window.innerHeight

  const evidentă = (element) => {
    const stil = getComputedStyle(element)
    if (stil.display === 'none' || stil.visibility === 'hidden') return false
    if (Number(stil.opacity) === 0) return false
    const cutie = element.getBoundingClientRect()
    return cutie.width > 0 && cutie.height > 0
  }

  const numește = (element) => {
    const clase =
      typeof element.className === 'string' && element.className !== ''
        ? `.${element.className.trim().split(/\s+/).join('.')}`
        : ''
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${clase}`
  }

  const toate = [...document.body.querySelectorAll('*')].filter(evidentă)

  // 1. Nimic nu iese lateral din ecran.
  if (document.documentElement.scrollWidth > lățime + 1) {
    abateri.push({
      fel: 'ieșit',
      element: 'document',
      detaliu: `se derulează lateral: ${document.documentElement.scrollWidth}px > ${lățime}px`,
    })
  }
  for (const element of toate) {
    const cutie = element.getBoundingClientRect()
    if (cutie.right > lățime + 0.5) {
      abateri.push({
        fel: 'ieșit',
        element: numește(element),
        detaliu: `marginea dreaptă la ${Math.round(cutie.right)}px, ecranul are ${lățime}px`,
      })
    }
    if (cutie.left < -0.5) {
      abateri.push({
        fel: 'ieșit',
        element: numește(element),
        detaliu: `marginea stângă la ${Math.round(cutie.left)}px`,
      })
    }
  }

  // 2. Niciun text sub bara de status.
  const cuText = toate.filter((element) =>
    [...element.childNodes].some(
      (nod) => nod.nodeType === 3 && nod.textContent.trim() !== '',
    ),
  )
  for (const element of cuText) {
    const cutie = element.getBoundingClientRect()
    if (cutie.top < siguranță.sus - 0.5) {
      abateri.push({
        fel: 'sub-bară',
        element: numește(element),
        detaliu: `textul începe la ${Math.round(cutie.top)}px, bara de status ține ${siguranță.sus}px`,
      })
    }
  }

  // 3. Nicio zonă apăsabilă mai mică decât un deget, și niciuna sub indicator.
  const deApăsat = [...document.body.querySelectorAll(apăsabile)].filter(evidentă)
  for (const element of deApăsat) {
    const cutie = element.getBoundingClientRect()
    if (cutie.width < zonaMinimă - 0.5 || cutie.height < zonaMinimă - 0.5) {
      abateri.push({
        fel: 'prea-mic',
        element: numește(element),
        detaliu: `${Math.round(cutie.width)}×${Math.round(cutie.height)}px, minimul e ${zonaMinimă}px`,
      })
    }
    if (cutie.bottom > înălțime - siguranță.jos + 0.5) {
      abateri.push({
        fel: 'sub-indicator',
        element: numește(element),
        detaliu: `se termină la ${Math.round(cutie.bottom)}px, indicatorul de jos ține ${siguranță.jos}px`,
      })
    }
  }

  return { abateri, numărate: { text: cuText.length, apăsabile: deApăsat.length } }
}

/** CSS-ul care simulează marginile de siguranță ale telefonului. */
export function cssSiguranță(siguranță = SIGURANȚĂ) {
  return `:root {
    --safe-top: ${siguranță.sus}px !important;
    --safe-bottom: ${siguranță.jos}px !important;
    --safe-left: 0px !important;
    --safe-right: 0px !important;
  }`
}
