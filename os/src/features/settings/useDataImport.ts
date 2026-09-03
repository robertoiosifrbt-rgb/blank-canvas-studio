import { useState } from 'react'
import { writeJson } from '../../shared/storage'
import { replaceAllPhotoSets } from '../progress-photos/db'
import { deserializePhotoSets } from './backupPhotos'
import { readBackup, type ImportedSection, type ImportResult } from './importData'

const PROFILE_KEY = 'gym-app:profile'
const UNITS_KEY = 'gym-app:units'

/*
 * „Import data": ia un fișier scos de „Export data" și îl pune la loc.
 *
 * Importul e în **doi pași**, cu o confirmare la mijloc. Pasul întâi doar
 * citește fișierul și spune ce e în el; abia al doilea scrie.
 */

export type ImportStage =
  | { step: 'idle'; error: string | null }
  | { step: 'confirming'; result: Extract<ImportResult, { ok: true }>; fileName: string }
  | { step: 'done'; written: number }

interface LocalWrite {
  key: string
  value: unknown
}

function restore(previous: Map<string, string | null>): boolean {
  let intact = true
  for (const [key, value] of previous) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      intact = false
    }
  }
  return intact
}

function writeAllLocal(writes: LocalWrite[]):
  | { ok: true; previous: Map<string, string | null> }
  | { ok: false; error: string } {
  const previous = new Map<string, string | null>()

  for (const write of writes) {
    try {
      previous.set(write.key, localStorage.getItem(write.key))
    } catch (error) {
      const restored = restore(previous)
      const detail = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: `Saved data could not be read before import (${detail}). ${restored ? 'Nothing was changed.' : 'Reload the app before changing anything else.'}`,
      }
    }

    const result = writeJson(write.key, write.value)
    if (result.ok) continue

    const restored = restore(previous)
    if (restored) return { ok: false, error: `${result.error} Nothing was changed.` }
    return {
      ok: false,
      error: `${result.error} Some of the old data could not be put back either — reload the app before changing anything else.`,
    }
  }

  return { ok: true, previous }
}

function sectionWrites(sections: ImportedSection[]): LocalWrite[] {
  return sections.map((section) => ({ key: section.storageKey, value: section.value }))
}

export function useDataImport() {
  const [stage, setStage] = useState<ImportStage>({ step: 'idle', error: null })

  async function chooseFile(file: File) {
    let text: string
    try {
      text = await file.text()
    } catch (error) {
      setStage({ step: 'idle', error: `Could not read that file (${error instanceof Error ? error.message : String(error)}).` })
      return
    }

    const result = readBackup(text)
    if (!result.ok) {
      setStage({ step: 'idle', error: result.error })
      return
    }
    setStage({ step: 'confirming', result, fileName: file.name })
  }

  async function confirmImport(): Promise<void> {
    if (stage.step !== 'confirming') return
    const { sections, extras } = stage.result

    // Decode photos before changing localStorage. If the image payload is bad,
    // import stops while every piece of existing data is still untouched.
    let restoredPhotos
    try {
      restoredPhotos = extras.progressPhotos === undefined ? undefined : deserializePhotoSets(extras.progressPhotos)
    } catch (error) {
      setStage({ step: 'idle', error: `The progress photos in that backup could not be restored (${error instanceof Error ? error.message : String(error)}). Nothing was changed.` })
      return
    }

    const writes = sectionWrites(sections)
    // Old backups did not carry these values. Missing means preserve, not erase.
    if (extras.profile !== undefined) writes.push({ key: PROFILE_KEY, value: extras.profile })
    if (extras.units !== undefined) writes.push({ key: UNITS_KEY, value: extras.units })

    const localResult = writeAllLocal(writes)
    if (!localResult.ok) {
      setStage({ step: 'idle', error: localResult.error })
      return
    }

    if (restoredPhotos !== undefined) {
      try {
        // IndexedDB transactions are atomic: a failed replace leaves the old
        // photo store intact. If it fails, put localStorage back as well.
        await replaceAllPhotoSets(restoredPhotos)
      } catch (error) {
        const localRestored = restore(localResult.previous)
        const detail = error instanceof Error ? error.message : String(error)
        setStage({
          step: 'idle',
          error: localRestored
            ? `Progress photos could not be restored (${detail}). Nothing was changed.`
            : `Progress photos could not be restored (${detail}), and some local data could not be put back. Reload the app before changing anything else.`,
        })
        return
      }
    }

    setStage({ step: 'done', written: sections.reduce((sum, section) => sum + section.value.length, 0) })
  }

  function cancel() {
    setStage({ step: 'idle', error: null })
  }

  return { stage, chooseFile, confirmImport, cancel }
}
