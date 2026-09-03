import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

function goTo(tab: string) {
  fireEvent.click(screen.getByRole('button', { name: tab }))
}

/*
 * No screen in the visual target has an app-name bar above it — every screen
 * carries its own title. The bar used to sit above all of them, and its
 * safe-area padding stacked with the content's, pushing everything down.
 */
describe('App shell', () => {
  it('has no global app-name bar', () => {
    const { container } = render(<App />)

    expect(screen.queryByText('Gym App')).not.toBeInTheDocument()
    expect(container.querySelector('.app-header')).toBeNull()
  })

  it('starts on Home, which opens with the greeting rather than a page title', () => {
    localStorage.setItem('gym-app:profile', JSON.stringify({ name: 'Roberto' }))
    render(<App />)

    expect(screen.getByRole('heading', { name: /Hey Roberto/ })).toBeInTheDocument()
  })

  /* Fără nume salvat, salutul nu inventează unul — era „Hey Roberto" în cod. */
  it('greets without a name until one is set in Settings', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /Hey there/ })).toBeInTheDocument()
  })

  /*
   * Sistemul de unități e ales într-un ecran și citit în celelalte. Cu un hook
   * per ecran în loc de context, ecranele montate ar fi rămas pe kilograme
   * până la o reîncărcare — de aici testul ăsta, care traversează ecranele.
   */
  it('carries the unit choice from Settings to the other screens', () => {
    localStorage.setItem(
      'gym-app:measurements',
      JSON.stringify([{ id: 'm1', date: '2026-07-15', weightKg: 80, waistCm: 90 }]),
    )
    render(<App />)

    goTo('Settings')
    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }))

    goTo('Body')
    fireEvent.click(screen.getByRole('tab', { name: 'Composition' }))
    expect(screen.getByText('176.4')).toBeInTheDocument()
    expect(screen.getAllByText('lb').length).toBeGreaterThan(0)
  })

  it('gives every other tab exactly one top-level heading', () => {
    render(<App />)

    goTo('Body')
    expect(screen.getByRole('heading', { level: 1, name: 'Body Overview' })).toBeInTheDocument()

    goTo('Workout')
    expect(screen.getByRole('heading', { level: 1, name: 'Workout Log' })).toBeInTheDocument()

    goTo('Progress')
    expect(screen.getByRole('heading', { level: 1, name: 'Progress Photos' })).toBeInTheDocument()

    goTo('Settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('titles the sub-pages too', () => {
    render(<App />)

    goTo('Workout')
    fireEvent.click(screen.getByRole('button', { name: 'Exercises' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Exercises' })).toBeInTheDocument()

    goTo('Body')
    fireEvent.click(screen.getByRole('tab', { name: 'Measurements' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Body Measurements' })).toBeInTheDocument()
  })

  /*
   * Tab-urile Log / Exercises stăteau deasupra titlului „Workout Log", adică
   * arătau ca o a doua bară globală — exact forma scoasă în etapa 1. Fiecare
   * ecran din target începe cu propriul titlu; ce filtrează ecranul vine sub el,
   * ca la Body.
   */
  it('puts the Log / Exercises tabs under the screen title, not above it', () => {
    const { container } = render(<App />)

    goTo('Workout')
    const title = screen.getByRole('heading', { level: 1, name: 'Workout Log' })
    const tabs = container.querySelector('.sub-nav')!
    expect(title.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Exercises' }))
    const exercisesTitle = screen.getByRole('heading', { level: 1, name: 'Exercises' })
    const exercisesTabs = container.querySelector('.sub-nav')!
    expect(exercisesTitle.compareDocumentPosition(exercisesTabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  /*
   * Two headings of the same rank on one screen is the shape the old markup
   * kept drifting into — a page title plus a leftover section title styled the
   * same. One h1 per screen keeps the hierarchy readable to a screen reader.
   */
  it('never shows two page titles at once', () => {
    render(<App />)

    for (const tab of ['Body', 'Workout', 'Progress', 'Settings']) {
      goTo(tab)
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    }
  })
})
