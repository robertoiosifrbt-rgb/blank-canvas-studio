// Exportul: singurul lucru din tot planul care îți dă control care nu depinde
// de nimeni. Un buton, un fișier pe telefonul tău.

import type { Item } from './item'

export type Fișier = {
  nume: string
  /** Tot conținutul, ca text. */
  conținut: string
}

/**
 * Snapshot-ul întreg, ca fișier.
 *
 * Include și rândurile șterse și momentul până la care e sincronizat: un
 * fișier care nu spune cât de proaspăt e ar promite mai mult decât știe.
 */
export function fișierDeExport(
  utilizator: string,
  itemi: readonly Item[],
  cursor: string | null,
  acum: Date,
): Fișier {
  const conținut = JSON.stringify(
    {
      aplicație: 'life-control-centre',
      versiuneFormat: 1,
      utilizator,
      exportatLa: acum.toISOString(),
      sincronizatPânăLa: cursor,
      itemi,
    },
    null,
    2,
  )

  const zi = acum.toISOString().slice(0, 10)
  return { nume: `life-control-centre-${zi}.json`, conținut }
}
