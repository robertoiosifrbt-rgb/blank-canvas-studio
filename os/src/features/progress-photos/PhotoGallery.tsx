import { useEffect, useMemo, useState } from 'react'
import { dayLabel } from '../../shared/localDate'
import { PHOTO_ANGLES, type ProgressPhotoSet, type PhotoAngle } from './types'

interface PhotoGalleryProps {
  photoSets: ProgressPhotoSet[]
  filter?: 'all' | 'front' | 'side' | 'back'
}

const angleLabels: Record<PhotoAngle, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left side',
  right: 'Right side',
}

/** Which angles a filter shows. `all` fills the mockup's three columns. */
const anglesFor: Record<NonNullable<PhotoGalleryProps['filter']>, PhotoAngle[]> = {
  all: ['front', 'left', 'back'],
  front: ['front'],
  side: ['left', 'right'],
  back: ['back'],
}

export function PhotoGallery({ photoSets, filter = 'all' }: PhotoGalleryProps) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  /*
   * One object URL per photo, revoked when the set changes or the gallery
   * unmounts. Without the cleanup every filter change would leak the whole
   * gallery's blobs, and a long session of flicking between tabs adds up to
   * real memory on a phone.
   */
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const set of photoSets) {
      for (const angle of PHOTO_ANGLES) {
        next[`${set.id}-${angle}`] = URL.createObjectURL(set.photos[angle])
      }
    }
    setUrls(next)
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url))
  }, [photoSets])

  const visibleAngles = useMemo(() => anglesFor[filter], [filter])

  if (photoSets.length === 0) return <p>No progress photos yet</p>

  return (
    <div className="progress-photo-groups">
      {photoSets.map((set) => {
        // `2026-07-15` reads as a database row, not as a date. The gallery is
        // the one place the owner scans by date, so it gets the written form.
        const readableDate = dayLabel(set.date)
        return (
          <section className="progress-photo-group" key={set.id}>
            <h2>{readableDate}</h2>
            <div className="progress-photo-grid">
              {visibleAngles.map((angle) => (
                <figure className="progress-photo-tile" key={angle}>
                  <img
                    src={urls[`${set.id}-${angle}`]}
                    alt={`${angleLabels[angle]} photo from ${readableDate}`}
                  />
                  <figcaption>{angleLabels[angle]}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
