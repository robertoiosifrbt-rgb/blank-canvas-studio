interface StorageNoticeProps {
  message: string | null
  onDismiss: () => void
}

/**
 * Shown when saving or loading data went wrong. Deliberately not silent and
 * not auto-hiding: on a phone there is no console to check, so a refused write
 * has to be visible or the user will believe the data is safe.
 */
export function StorageNotice({ message, onDismiss }: StorageNoticeProps) {
  if (!message) return null

  return (
    <div className="storage-notice" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  )
}
