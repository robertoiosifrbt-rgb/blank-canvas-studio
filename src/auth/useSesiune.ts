import { useEffect, useState } from 'react'

import { laSchimbareaSesiunii, sesiuneaCurentă } from '../repository/auth'
import type { Sesiune } from '../repository/auth'

export type StareSesiune =
  | { seÎncarcă: true }
  | { seÎncarcă: false; sesiune: Sesiune | null }

/**
 * Sesiunea curentă, urmărită.
 *
 * Cât se încarcă nu spune „nu ești autentificat" — altfel un utilizator logat
 * ar vedea ecranul de intrare pentru o clipă la fiecare deschidere.
 */
export function useSesiune(): StareSesiune {
  const [stare, setStare] = useState<StareSesiune>({ seÎncarcă: true })
  const [eroare, setEroare] = useState<Error | null>(null)

  useEffect(() => {
    let activ = true
    let opreșteAscultarea = () => {}

    // Tot ce poate eșua — inclusiv o configurație lipsă, care aruncă la
    // construirea clientului — trece prin promisiunea asta. Aruncat din corpul
    // efectului n-ar fi prins de error boundary.
    const pornește = async () => {
      opreșteAscultarea = laSchimbareaSesiunii((sesiune) => {
        if (activ) setStare({ seÎncarcă: false, sesiune })
      })
      const sesiune = await sesiuneaCurentă()
      if (activ) setStare({ seÎncarcă: false, sesiune })
    }

    void pornește().catch((motiv: unknown) => {
      if (activ) {
        setEroare(motiv instanceof Error ? motiv : new Error(String(motiv)))
      }
    })

    return () => {
      activ = false
      opreșteAscultarea()
    }
  }, [])

  // Aruncată la randare, ca s-o prindă error boundary-ul și să se vadă.
  if (eroare !== null) throw eroare
  return stare
}
