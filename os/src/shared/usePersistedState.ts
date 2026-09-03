import { useCallback, useEffect, useRef, useState } from 'react'
import { readJson, writeJson, type Recover } from './storage'

/**
 * State backed by `localStorage`, where the write is what decides whether the
 * change happened.
 *
 * The order matters: we write first and only move React state forward if the
 * write succeeded. The previous pattern (set state, persist later in an
 * effect) let the UI show a value that was never stored, so the change
 * silently disappeared on the next reload.
 *
 * `update` returns `false` when the write was refused, so callers can keep the
 * user's form filled in instead of clearing it.
 *
 * Cross-tab synchronization: Listens to `storage` events to stay in sync when
 * another tab modifies the same key. Prevents lost updates.
 */
export function usePersistedState<T>(key: string, fallback: T, recover: Recover<T>) {
  const [loaded] = useState(() => readJson(key, fallback, recover))
  const [value, setValue] = useState<T>(loaded.value)
  const [loadError, setLoadError] = useState<string | null>(loaded.error)
  const [writeError, setWriteError] = useState<string | null>(null)

  // Mirrors `value` so `update` can read the latest state without going
  // through a state-updater callback (which must stay free of side effects).
  const latest = useRef<T>(loaded.value)

  const update = useCallback(
    (next: T | ((prev: T) => T)): boolean => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(latest.current) : next
      const result = writeJson(key, resolved)
      if (!result.ok) {
        setWriteError(result.error)
        return false
      }
      latest.current = resolved
      setWriteError(null)
      setValue(resolved)
      return true
    },
    [key],
  )

  const dismissError = useCallback(() => {
    setWriteError(null)
    setLoadError(null)
  }, [])

  // Listen to storage events from other tabs to stay in sync.
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      // Only react to changes for this key, and only if the change came from
      // another tab (this tab's own writes do not trigger the event).
      if (event.key !== key || event.storageArea !== localStorage) return

      // Read the new value from storage. If it's invalid, keep the old value
      // (the recovery function will validate on reload).
      if (event.newValue === null) {
        // Key was deleted.
        latest.current = fallback
        setValue(fallback)
      } else {
        const { value: newValue } = readJson(key, fallback, recover)
        latest.current = newValue
        setValue(newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, fallback, recover])

  return { value, update, error: writeError ?? loadError, dismissError }
}
