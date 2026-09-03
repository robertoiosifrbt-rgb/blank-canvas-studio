import { useRef, useState } from 'react'
import { PageHeader } from '../../shared/PageHeader'
import { StorageNotice } from '../../shared/StorageNotice'
import { unitSystemLabel, type UnitSystem } from '../../shared/units'
import { useUnits } from '../../shared/unitsContext'
import { resizeImage } from '../progress-photos/resizeImage'
import { useDataExport } from './useDataExport'
import { useDataImport } from './useDataImport'
import { describeSections, totalDropped, totalEntries } from './importData'
import { initials, MAX_AVATAR_BYTES, useProfile } from './useProfile'
import './settings.css'

const AVATAR_PIXELS = 192

function Chevron() {
  return <span className="settings-chevron" aria-hidden="true">›</span>
}

function InfoRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="settings-row">
      <span className="settings-row-icon" aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  )
}

function ProfileCard() {
  const { profile, setName, setAvatar, error, dismissError } = useProfile()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const displayName = profile.name.trim() || 'Your name'

  function open() {
    setDraftName(profile.name)
    setAvatarError(null)
    setEditing(true)
  }

  async function pickAvatar(file: File) {
    setAvatarError(null)
    try {
      const blob = await resizeImage(file, AVATAR_PIXELS)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('Could not read the picture'))
        reader.readAsDataURL(blob)
      })

      if (dataUrl.length > MAX_AVATAR_BYTES) {
        setAvatarError('That picture is too large even after resizing. Try a smaller one.')
        return
      }
      if (!setAvatar(dataUrl)) setAvatarError('The picture could not be saved — this device may be out of storage.')
    } catch (error) {
      setAvatarError(`That picture could not be used (${error instanceof Error ? error.message : String(error)}).`)
    }
  }

  return (
    <>
      <StorageNotice message={error} onDismiss={dismissError} />

      <section className="settings-profile-card">
        {profile.avatar ? (
          <img className="settings-avatar" src={profile.avatar} alt="" />
        ) : (
          <div className="settings-avatar" aria-hidden="true">{initials(profile.name)}</div>
        )}
        <div className="settings-profile-copy">
          <strong className={profile.name.trim() ? '' : 'is-placeholder'}>{displayName}</strong>
          <span>GYM APP profile</span>
        </div>
        {!editing && <button type="button" className="settings-profile-edit" onClick={open}>Edit</button>}
      </section>

      {editing && (
        <section className="settings-profile-editor">
          <div className="field">
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              value={draftName}
              maxLength={40}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>

          <div className="settings-avatar-actions">
            <button type="button" onClick={() => fileInput.current?.click()}>
              {profile.avatar ? 'Change picture' : 'Add picture'}
            </button>
            {profile.avatar && (
              <button type="button" className="danger-action" onClick={() => setAvatar(undefined)}>Remove picture</button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void pickAvatar(file)
              }}
            />
          </div>

          {avatarError && <p className="form-error" role="alert">{avatarError}</p>}

          <div className="settings-editor-actions">
            <button
              type="button"
              className="settings-save"
              onClick={() => {
                if (setName(draftName.trim())) setEditing(false)
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </section>
      )}
    </>
  )
}

function UnitsRow() {
  const { system, setSystem } = useUnits()
  const options: Array<{ value: UnitSystem; label: string }> = [
    { value: 'metric', label: 'Metric' },
    { value: 'imperial', label: 'Imperial' },
  ]

  return (
    <div className="settings-row">
      <span className="settings-row-icon" aria-hidden="true">◎</span>
      <div>
        <strong>Units</strong>
        <span>{unitSystemLabel(system)}</span>
      </div>
      <div className="settings-choice" role="group" aria-label="Units">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={system === option.value ? 'is-selected' : ''}
            aria-pressed={system === option.value}
            onClick={() => setSystem(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ImportRow() {
  const { stage, chooseFile, confirmImport, cancel } = useDataImport()
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <button type="button" className="settings-row settings-row-button" onClick={() => fileInput.current?.click()}>
        <span className="settings-row-icon" aria-hidden="true">⇧</span>
        <div>
          <strong>Import data</strong>
          <span>Restore everything from an exported file</span>
        </div>
        <Chevron />
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void chooseFile(file)
        }}
      />

      {stage.step === 'idle' && stage.error && <p className="form-error" role="alert">{stage.error}</p>}

      {stage.step === 'confirming' && (
        <div className="settings-import-panel" role="group" aria-label="Confirm import">
          <strong>{stage.fileName}</strong>
          <p>
            This file holds {describeSections(stage.result.sections)}.
            {stage.result.extras.progressPhotos !== undefined && ` ${stage.result.extras.progressPhotos.length} progress photo sets are included.`}
            {totalDropped(stage.result.sections) + stage.result.extras.progressPhotosDropped > 0 &&
              ` ${totalDropped(stage.result.sections) + stage.result.extras.progressPhotosDropped} entries in it could not be read and will be left out.`}
          </p>
          <p className="settings-import-warning">
            Everything covered by this backup is replaced when you confirm. New backups include your profile, units and
            progress photos as well as these {totalEntries(stage.result.sections)} workout/body entries. Export first if you
            want to keep what is here now.
          </p>
          <div className="settings-editor-actions">
            <button type="button" className="danger-action" onClick={() => void confirmImport()}>Replace my data</button>
            <button type="button" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {stage.step === 'done' && (
        <div className="settings-import-panel" role="status">
          <strong>Imported {stage.written} workout/body entries</strong>
          <p>Reload the app to see the restored data.</p>
          <div className="settings-editor-actions">
            <button type="button" className="settings-save" onClick={() => window.location.reload()}>Reload now</button>
          </div>
        </div>
      )}
    </>
  )
}

export function SettingsPage() {
  const { downloadAsJson, exporting, error: exportError, dismissError: dismissExportError } = useDataExport()

  return (
    <section className="settings-page">
      <PageHeader title="Settings" align="left" />

      <ProfileCard />

      <section className="settings-section">
        <h2>Preferences</h2>
        <div className="settings-list">
          <UnitsRow />
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true">◌</span>
            <div>
              <strong>Workout reminders</strong>
              <span>Needs browser notifications — not built yet</span>
            </div>
            <span className="settings-status-pill">Soon</span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Data</h2>
        <StorageNotice message={exportError} onDismiss={dismissExportError} />
        <div className="settings-list">
          <button
            type="button"
            className="settings-row settings-row-button"
            onClick={() => void downloadAsJson()}
            disabled={exporting}
          >
            <span className="settings-row-icon" aria-hidden="true">⇩</span>
            <div>
              <strong>{exporting ? 'Preparing export…' : 'Export data'}</strong>
              <span>Exercises, workouts, measurements, profile, units and progress photos</span>
            </div>
            <Chevron />
          </button>
          <ImportRow />
          <InfoRow icon="▣" title="Progress photos" detail="Included in export and restored with new backups" />
        </div>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <div className="settings-list">
          <InfoRow icon="i" title="Storage" detail="Workout and body data stay in this browser, on this device" />
          <InfoRow icon="?" title="GYM APP" detail="Personal training log" />
        </div>
      </section>
    </section>
  )
}
