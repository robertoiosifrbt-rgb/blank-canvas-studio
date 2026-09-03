import { PHOTO_ANGLES, isValidPhotoSet, type PhotoAngle, type ProgressPhotoSet } from '../progress-photos/types'
import { isCalendarDate, isNonEmptyString, isRecord } from '../../shared/validate'

export interface SerializedPhotoSet {
  id: string
  date: string
  photos: Record<PhotoAngle, string>
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read a progress photo'))
    reader.readAsDataURL(blob)
  })
}

export async function serializePhotoSets(photoSets: unknown[]): Promise<SerializedPhotoSet[]> {
  if (!photoSets.every(isValidPhotoSet)) {
    throw new Error('Some saved progress photos could not be read, so the export was cancelled.')
  }

  return Promise.all(
    photoSets.map(async (set) => {
      const pairs = await Promise.all(
        PHOTO_ANGLES.map(async (angle) => [angle, await blobToDataUrl(set.photos[angle])] as const),
      )
      return {
        id: set.id,
        date: set.date,
        photos: Object.fromEntries(pairs) as Record<PhotoAngle, string>,
      }
    }),
  )
}

export function parseSerializedPhotoSets(value: unknown): { value: SerializedPhotoSet[]; dropped: number } {
  if (!Array.isArray(value)) return { value: [], dropped: 1 }

  const parsed: SerializedPhotoSet[] = []
  let dropped = 0
  for (const entry of value) {
    if (!isRecord(entry) || !isNonEmptyString(entry.id) || !isCalendarDate(entry.date) || !isRecord(entry.photos)) {
      dropped += 1
      continue
    }

    const photos = entry.photos
    if (!PHOTO_ANGLES.every((angle) => typeof photos[angle] === 'string' && photos[angle].startsWith('data:image/'))) {
      dropped += 1
      continue
    }

    parsed.push({
      id: entry.id,
      date: entry.date,
      photos: Object.fromEntries(PHOTO_ANGLES.map((angle) => [angle, photos[angle] as string])) as Record<PhotoAngle, string>,
    })
  }
  return { value: parsed, dropped }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('A progress photo in the backup is unreadable.')

  const header = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mimeMatch = /^data:(image\/[^;,]+);base64$/i.exec(header)
  if (!mimeMatch) throw new Error('A progress photo in the backup is not a supported image.')

  let binary: string
  try {
    binary = atob(payload)
  } catch {
    throw new Error('A progress photo in the backup has invalid image data.')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeMatch[1] })
}

export function deserializePhotoSets(photoSets: SerializedPhotoSet[]): ProgressPhotoSet[] {
  return photoSets.map((set) => ({
    id: set.id,
    date: set.date,
    photos: Object.fromEntries(PHOTO_ANGLES.map((angle) => [angle, dataUrlToBlob(set.photos[angle])])) as Record<PhotoAngle, Blob>,
  }))
}
