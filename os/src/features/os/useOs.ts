import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { forgetKnown, persist, pull, setPushErrorHandler, type SyncMode } from './storage'
import { onAuthChange, signIn as authIn, signOut as authOut, signUp as authUp } from './db'
import { pullGym, watchGym } from './gymCloud'
import { syncPhotos, watchPhotos, type PhotoSync } from './photoCloud'
import { readLocal } from './storage'
import type { OsData } from './types'

/**
 * O singură sursă de adevăr pentru toate ecranele. Scrierile merg întâi în
 * memorie ca interfața să răspundă imediat, apoi în oglinda locală, apoi în
 * cloud, amânat.
 */
export interface OsStore {
  data: OsData
  mode: SyncMode
  error: string | null
  ready: boolean
  /** Ultima sincronizare a pozelor. `null` până se termină prima. */
  photos: PhotoSync | null
  /** Fără cont, datele rămân pe telefonul ăsta. */
  signedIn: boolean
  update: (change: (draft: OsData) => void) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export function useOs(): OsStore {
  const [data, setData] = useState<OsData>(() => readLocal().value)
  const [mode, setMode] = useState<SyncMode>('local')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [photos, setPhotos] = useState<PhotoSync | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  /* Se schimbă la logare și la delogare, ca pornirea de mai jos s-o ia de la
     capăt cu datele contului nou. */
  const [account, setAccount] = useState(0)

  /* Supabase anunță și reîmprospătarea tokenului, nu doar logarea. Pornirea
     se ia de la capăt numai când se schimbă omul: altfel o reîmprospătare
     căzută la mijloc ar reciti baza peste ce tocmai ai scris și n-ai apucat
     să urci. */
  const who = useRef<string | null>(null)
  useEffect(() => onAuthChange(session => {
    const id = session?.user.id ?? null
    if (id === who.current) return
    who.current = id
    forgetKnown()
    setReady(false)
    setAccount(n => n + 1)
  }), [])

  useEffect(() => {
    let alive = true
    let stopGym: (() => void) | undefined
    let stopPhotos: (() => void) | undefined
    setPushErrorHandler(message => { if (alive) setError(message) })
    void pull().then(async result => {
      if (!alive) return
      setData(result.data)
      setMode(result.mode)
      setError(result.error)
      setSignedIn(result.signedIn)
      setReady(true)
      /* Sala își ține datele în aceleași chei de browser, în alt sertar din
         cloud. Se aduc înainte ca ecranul de sală să se monteze, ca să pornească
         direct cu ce e mai nou, și abia apoi ascultăm scrierile ei. Dacă OS-ul
         n-a prins cloud-ul, nici sala nu are unde să urce. */
      if (result.mode !== 'cloud') return
      const gym = await pullGym()
      if (!alive) return
      if (gym.error) setError(gym.error)
      stopGym = watchGym(message => { if (alive) setError(message) })
      /* Pozele merg pe alt drum — Storage, prin `photo-api` — și pot lipsi cu
         totul dacă funcția aia nu e pusă încă. De aceea rezultatul lor stă
         separat, arătat în Setări, și nu ca eroare peste toată aplicația. */
      const shots = await syncPhotos()
      if (!alive) return
      setPhotos(shots)
      stopPhotos = watchPhotos(result => { if (alive) setPhotos(result) })
    })
    return () => { alive = false; stopGym?.(); stopPhotos?.() }
  }, [account])

  const update = useCallback((change: (draft: OsData) => void) => {
    setData(current => {
      const next = structuredClone(current)
      change(next)
      persist(next, mode)
      return next
    })
  }, [mode])

  /* Erorile de logare se întorc ca text, ca ecranul să le arate sub câmp în
     loc să pice toată aplicația. */
  const guard = async (run: () => Promise<void>): Promise<string | null> => {
    try {
      await run()
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  const signIn = useCallback((email: string, password: string) =>
    guard(() => authIn(email, password)), [])
  const signUp = useCallback((email: string, password: string) =>
    guard(() => authUp(email, password)), [])
  const signOut = useCallback(async () => { await authOut() }, [])

  return useMemo(() => ({ data, mode, error, ready, photos, signedIn, update, signIn, signUp, signOut }),
    [data, mode, error, ready, photos, signedIn, update, signIn, signUp, signOut])
}
