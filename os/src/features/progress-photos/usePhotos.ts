import { useEffect, useState } from 'react'
import { isValidPhotoSet, type PhotoAngle, type ProgressPhotoSet } from './types'
import { getAllPhotoSets, savePhotoSet } from './db'

const byDateDesc = (a: ProgressPhotoSet, b: ProgressPhotoSet) => b.date.localeCompare(a.date)

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'this device is out of storage space'
  }
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export function usePhotos() {
  const [photoSets, setPhotoSets] = useState<ProgressPhotoSet[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getAllPhotoSets()
      .then((loaded) => {
        if (!active) return
        const valid = loaded.filter(isValidPhotoSet)
        setPhotoSets(valid.sort(byDateDesc))
        // Unusable sets (missing or non-Blob images) are skipped, not deleted.
        // They cannot be shown, but throwing away the record is not ours to do.
        const skipped = loaded.length - valid.length
        if (skipped > 0) {
          setError(
            `${skipped} saved photo ${skipped === 1 ? 'set could' : 'sets could'} not be read and ` +
              `${skipped === 1 ? 'is' : 'are'} not shown. Nothing was deleted.`,
          )
        }
      })
      .catch((err) => {
        if (active) setError(`Could not load photos: ${describe(err)}`)
      })
    return () => {
      active = false
    }
  }, [])

  /**
   * Resolves to false when IndexedDB refused the write — the caller keeps the
   * selected photos so they do not have to be picked again. This must be
   * awaited: the save is asynchronous, and an `ErrorBoundary` cannot catch a
   * rejected promise, so a silent failure used to look like a successful save.
   */
  async function addPhotoSet(date: string, photos: Record<PhotoAngle, Blob>): Promise<boolean> {
    const photoSet: ProgressPhotoSet = { id: crypto.randomUUID(), date, photos }
    try {
      await savePhotoSet(photoSet)
    } catch (err) {
      setError(
        `These photos were not saved (${describe(err)}). ` +
          'They are still selected below, so you can try again — freeing storage space usually helps.',
      )
      return false
    }
    setError(null)
    setPhotoSets((prev) => [...prev, photoSet].sort(byDateDesc))
    return true
  }

  function dismissError() {
    setError(null)
  }

  return { photoSets, addPhotoSet, error, dismissError }
}
