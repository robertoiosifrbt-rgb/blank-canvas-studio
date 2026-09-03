import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { UnitsProvider } from '../../shared/UnitsProvider'

const PROFILE_KEY = 'gym-app:profile'
const MEASUREMENTS_KEY = 'gym-app:measurements'

const renderSettings = () =>
  render(
    <UnitsProvider>
      <SettingsPage />
    </UnitsProvider>,
  )

/** Un fișier ca cel scos de „Export data", ambalat cum îl primește `<input type="file">`. */
function backupFile(contents: unknown, name = 'gym-app-backup-2026-08-12.json') {
  return new File([JSON.stringify(contents)], name, { type: 'application/json' })
}

function chooseFile(labelledInput: HTMLElement, file: File) {
  Object.defineProperty(labelledInput, 'files', { value: [file], configurable: true })
  fireEvent.change(labelledInput)
}

const importInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[accept="application/json,.json"]')!

describe('SettingsPage profile', () => {
  it('starts without a name and saves the one you type', () => {
    renderSettings()

    expect(screen.getByText('Your name')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roberto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Roberto')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toMatchObject({ name: 'Roberto' })
  })

  it('shows the initials of the saved name while there is no picture', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: 'Roberto Iosif' }))
    renderSettings()

    expect(screen.getByText('RI')).toBeInTheDocument()
  })

  it('ignores an avatar that is not an inline data URL', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: 'Roberto', avatar: 'https://example.com/me.jpg' }))
    const { container } = renderSettings()

    expect(container.querySelector('img.settings-avatar')).toBeNull()
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('SettingsPage units', () => {
  it('starts on metric and remembers the switch to imperial', () => {
    renderSettings()

    expect(screen.getByText('kg, cm')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }))

    expect(screen.getByText('lb, in')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('gym-app:units')!)).toBe('imperial')
  })

  it('marks the chosen system as pressed, for anyone not seeing the colour', () => {
    renderSettings()

    expect(screen.getByRole('button', { name: 'Metric' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Imperial' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('SettingsPage import', () => {
  it('says what a file holds and replaces the data only after confirmation', async () => {
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify([{ id: 'old', date: '2020-01-01', weightKg: 70 }]))
    const { container } = renderSettings()

    chooseFile(importInput(container), backupFile({ measurements: [{ id: 'm1', date: '2026-07-15', weightKg: 82.4 }] }))

    expect(await screen.findByText(/1 measurements/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(MEASUREMENTS_KEY)!)[0].id).toBe('old')

    fireEvent.click(screen.getByRole('button', { name: 'Replace my data' }))

    expect(JSON.parse(localStorage.getItem(MEASUREMENTS_KEY)!)).toEqual([
      { id: 'm1', date: '2026-07-15', weightKg: 82.4 },
    ])
    expect(screen.getByText('Imported 1 workout/body entries')).toBeInTheDocument()
  })

  it('leaves everything untouched when the confirmation is cancelled', async () => {
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify([{ id: 'old', date: '2020-01-01', weightKg: 70 }]))
    const { container } = renderSettings()

    chooseFile(importInput(container), backupFile({ measurements: [] }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(JSON.parse(localStorage.getItem(MEASUREMENTS_KEY)!)[0].id).toBe('old')
    expect(screen.queryByRole('button', { name: 'Replace my data' })).not.toBeInTheDocument()
  })

  it('explains a file it cannot use instead of failing silently', async () => {
    const { container } = renderSettings()

    chooseFile(importInput(container), new File(['{"todos":[]}'], 'todos.json', { type: 'application/json' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('does not look like a GYM APP backup')
  })

  it('puts everything back when a write is refused halfway through', async () => {
    localStorage.setItem('gym-app:exercises', JSON.stringify([{ id: 'old-e', name: 'Squat', fields: [] }]))
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify([{ id: 'old-m', date: '2020-01-01', weightKg: 70 }]))
    const { container } = renderSettings()

    chooseFile(
      importInput(container),
      backupFile({
        exercises: [{ id: 'new-e', name: 'Deadlift', fields: [] }],
        measurements: [{ id: 'new-m', date: '2026-07-15', weightKg: 82.4 }],
      }),
    )
    await screen.findByRole('button', { name: 'Replace my data' })

    const original = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === MEASUREMENTS_KEY && value.includes('new-m')) throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Replace my data' }))
    setItem.mockRestore()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nothing was changed'))
    expect(JSON.parse(localStorage.getItem('gym-app:exercises')!)[0].id).toBe('old-e')
    expect(JSON.parse(localStorage.getItem(MEASUREMENTS_KEY)!)[0].id).toBe('old-m')
  })
})

describe('SettingsPage rows', () => {
  it('has no rows that promise a screen and do nothing', () => {
    const { container } = renderSettings()

    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()
    for (const chevron of container.querySelectorAll('.settings-chevron')) {
      expect(chevron.closest('button')).not.toBeNull()
    }
  })

  it('marks as “Soon” only what is genuinely not built', () => {
    renderSettings()

    expect(screen.getAllByText('Soon')).toHaveLength(1)
    expect(screen.getByText('Workout reminders')).toBeInTheDocument()
  })
})
