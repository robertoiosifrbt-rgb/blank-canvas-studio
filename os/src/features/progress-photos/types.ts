import { isCalendarDate, isNonEmptyString, isRecord } from '../../shared/validate'

export type PhotoAngle = 'front' | 'back' | 'left' | 'right'

export const PHOTO_ANGLES: PhotoAngle[] = ['front', 'back', 'left', 'right']

export interface ProgressPhotoSet {
  id: string
  date: string
  photos: Record<PhotoAngle, Blob>
}

/**
 * Takes `unknown` on purpose: what comes back from IndexedDB is whatever some
 * version of this app once put there, not something the type system has
 * checked. A set without four real Blobs cannot be rendered — `createObjectURL`
 * would throw during the gallery's render and blank the page.
 */
export function isValidPhotoSet(set: unknown): set is ProgressPhotoSet {
  if (!isRecord(set)) return false
  if (!isNonEmptyString(set.id) || !isCalendarDate(set.date)) return false
  if (!isRecord(set.photos)) return false
  const photos = set.photos
  return PHOTO_ANGLES.every((angle) => photos[angle] instanceof Blob)
}
