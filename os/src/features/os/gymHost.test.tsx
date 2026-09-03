import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App, { GymScreens } from '../../app/App'
import { UnitsProvider } from '../../shared/UnitsProvider'

/* Sala e modul în Roberto OS, nu a doua aplicație lipită. Găzduită, gazda îi
   dă navigația și rama; singură, și le desenează pe ale ei. Astea sunt cele
   două lucruri care se strică tăcut dacă se schimbă încadrarea. */

function hosted(page: Parameters<typeof GymScreens>[0]['page'] = 'home') {
  return render(
    <UnitsProvider>
      <div className="os-gym">
        <GymScreens hosted page={page} onPage={vi.fn()} />
      </div>
    </UnitsProvider>,
  )
}

describe('sala găzduită de Roberto OS', () => {
  beforeEach(() => localStorage.clear())

  it('nu-și mai pune bara ei de navigare peste cea a OS-ului', () => {
    hosted()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })

  it('își păstrează bara când rulează singură', () => {
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  it('arată ecranul cerut de gazdă, nu unul ținut de ea', () => {
    hosted('body')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/body/i)
  })

  it('renunță la rama proprie, ca să nu fie o pagină în pagină', () => {
    const { container } = hosted()
    expect(container.querySelector('.app-shell-hosted')).not.toBeNull()
  })
})
