import { useCallback, useEffect, useMemo, useState } from 'react'
import { persist, pull, setPushErrorHandler, type SyncMode } from './storage'
import { pullGym, watchGym } from './gymCloud'
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
  update: (change: (draft: OsData) => void) => void
}

export function useOs(): OsStore {
  const [data, setData] = useState<OsData>(() => readLocal().value)
  const [mode, setMode] = useState<SyncMode>('local')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    let stopGym: (() => void) | undefined
    setPushErrorHandler(message => { if (alive) setError(message) })
    void pull().then(async result => {
      if (!alive) return
      setData(result.data)
      setMode(result.mode)
      setError(result.error)
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
    })
    return () => { alive = false; stopGym?.() }
  }, [])

  const update = useCallback((change: (draft: OsData) => void) => {
    setData(current => {
      const next = structuredClone(current)
      change(next)
      persist(next, mode)
      return next
    })
  }, [mode])

  return useMemo(() => ({ data, mode, error, ready, update }), [data, mode, error, ready, update])
}
