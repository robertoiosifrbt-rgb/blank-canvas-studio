import { useState } from 'react'
import { StorageNotice } from '../../shared/StorageNotice'
import { usePhotos } from './usePhotos'
import { PhotoUploadForm } from './PhotoUploadForm'
import { PhotoGallery } from './PhotoGallery'
import { PageHeader } from '../../shared/PageHeader'

export function ProgressPhotosPage() {
  const { photoSets, addPhotoSet, error, dismissError } = usePhotos()
  const [filter, setFilter] = useState<'all' | 'front' | 'side' | 'back'>('all')
  const [showUploadForm, setShowUploadForm] = useState(false)

  const filterOptions: Array<{ value: 'all' | 'front' | 'side' | 'back'; label: string }> = [
    { value: 'all', label: 'All Photos' },
    { value: 'front', label: 'Front' },
    { value: 'side', label: 'Side' },
    { value: 'back', label: 'Back' },
  ]

  async function handleAddPhotos(date: string, photos: Record<string, Blob>) {
    const result = await addPhotoSet(date, photos as any)
    if (result) setShowUploadForm(false)
    return result
  }

  return (
    <section>
      <PageHeader
        title="Progress Photos"
        action={
          <button
            type="button"
            className="header-action-button"
            aria-label={showUploadForm ? 'Close photo upload' : 'Add photos'}
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            +
          </button>
        }
      />

      <StorageNotice message={error} onDismiss={dismissError} />

      {showUploadForm && (
        <div className="section-header">
          <h2>Upload New Photos</h2>
        </div>
      )}
      {showUploadForm && <PhotoUploadForm onAdd={handleAddPhotos} />}

      {photoSets.length > 0 && (
        <>
          <div className="progress-photo-filters">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`filter-button ${filter === option.value ? 'active' : ''}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <PhotoGallery photoSets={photoSets} filter={filter} />
        </>
      )}
      {photoSets.length === 0 && <p>No progress photos yet</p>}
    </section>
  )
}
