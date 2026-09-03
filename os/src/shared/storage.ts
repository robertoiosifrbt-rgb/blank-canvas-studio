/**
 * Every `localStorage` access in the app goes through here.
 *
 * Two failure modes are real on a phone and neither used to be handled:
 *
 * 1. Reading — a value can be corrupt (browser closed mid-write, manual
 *    editing, data written by an older version of the app). A bare
 *    `JSON.parse` throws during the very first render and takes the whole
 *    page down, which also hides the *other* keys that were still fine.
 * 2. Writing — `setItem` throws when the quota is exceeded or storage is
 *    blocked. The UI used to keep showing the new value anyway, so the change
 *    looked saved until the next reload.
 *
 * Recovery never silently destroys data: whenever we fail to use the stored
 * value as-is, the original string is copied to `<key>:corrupt` before the app
 * is allowed to overwrite the key.
 */

export const CORRUPT_SUFFIX = ':corrupt'

/**
 * Turns whatever was parsed out of storage into a usable value.
 *
 * `dropped` counts entries that had to be discarded and `repaired` counts
 * entries kept with some values blanked out, so the user can be told what was
 * lost instead of quietly seeing a shorter list or a missing measurement.
 */
export type Recover<T> = (parsed: unknown) => { value: T; dropped: number; repaired?: number }

export interface ReadResult<T> {
  value: T
  error: string | null
}

export type WriteResult = { ok: true } | { ok: false; error: string }

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Keeps the first corrupt value we ever saw for a key. Called before the app
 * can overwrite the key, and deliberately does not overwrite an existing
 * backup — the earliest copy is the one closest to the user's real data.
 */
function backUpCorruptValue(key: string, raw: string): void {
  const backupKey = `${key}${CORRUPT_SUFFIX}`
  try {
    if (localStorage.getItem(backupKey) === null) localStorage.setItem(backupKey, raw)
  } catch {
    // Backing up is best-effort: if storage is full or blocked there is
    // nothing useful to do, and failing here must not break loading.
  }
}

export function readJson<T>(key: string, fallback: T, recover: Recover<T>): ReadResult<T> {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch (error) {
    return {
      value: fallback,
      error: `Saved data could not be read (${describe(error)}). Changes made now may not be saved.`,
    }
  }

  if (raw === null) return { value: fallback, error: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    backUpCorruptValue(key, raw)
    return {
      value: fallback,
      error:
        'Saved data was unreadable, so this list started out empty. ' +
        `The original was kept under "${key}${CORRUPT_SUFFIX}" and has not been deleted.`,
    }
  }

  const { value, dropped, repaired = 0 } = recover(parsed)
  if (dropped > 0 || repaired > 0) {
    backUpCorruptValue(key, raw)
    const parts: string[] = []
    if (dropped > 0) {
      parts.push(
        `${dropped} saved ${dropped === 1 ? 'entry' : 'entries'} could not be read and ${dropped === 1 ? 'is' : 'are'} not shown`,
      )
    }
    if (repaired > 0) {
      parts.push(
        `${repaired} ${repaired === 1 ? 'entry had a value' : 'entries had values'} in an unexpected format, left blank`,
      )
    }
    return {
      value,
      error: `${parts.join('; ')}. The original data was kept under "${key}${CORRUPT_SUFFIX}" and has not been deleted.`,
    }
  }

  return { value, error: null }
}

export function writeJson(key: string, value: unknown): WriteResult {
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch (error) {
    return { ok: false, error: `Could not prepare the data for saving (${describe(error)}).` }
  }

  try {
    localStorage.setItem(key, serialized)
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        ok: false,
        error:
          'Not saved — this device is out of storage space. ' +
          'Free some space (deleting old progress photos helps most) and try again.',
      }
    }
    return {
      ok: false,
      error:
        `Not saved (${describe(error)}). ` +
        'Private browsing windows often block storage — try a normal window.',
    }
  }
}

/**
 * Result of parsing one stored entry: `null` when it is unusable, otherwise
 * the entry plus whether some of its values had to be blanked out.
 */
export type ParsedEntry<T> = { value: T; lossy?: boolean } | null

/** `recover` for a stored array: keeps the entries that pass, counts the rest. */
export function recoverArray<T>(parse: (entry: unknown) => ParsedEntry<T>): Recover<T[]> {
  return (parsed) => {
    // A non-array here means the key holds something structurally wrong (an
    // object, a bare number, data from a different app) — nothing to salvage,
    // but the raw string still gets backed up because `dropped` is non-zero.
    if (!Array.isArray(parsed)) return { value: [], dropped: 1 }

    const value: T[] = []
    let dropped = 0
    let repaired = 0
    for (const entry of parsed) {
      const result = parse(entry)
      if (result === null) {
        dropped += 1
        continue
      }
      if (result.lossy) repaired += 1
      value.push(result.value)
    }
    return { value, dropped, repaired }
  }
}
