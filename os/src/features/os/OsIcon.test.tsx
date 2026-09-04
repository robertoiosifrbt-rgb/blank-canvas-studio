import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { OsIcon } from './OsIcon'

/* Modulele făcute de utilizator au `kind` liber. Fără rezervă, bara ar avea
   găuri exact pe modulele lui, nu pe cele incluse — adică nu s-ar vedea la
   noi, ci la el. */
describe('iconurile barei de navigare', () => {
  it('desenează iconul cerut', () => {
    const { container } = render(<OsIcon name="calendar" />)
    expect(container.querySelector('path')?.getAttribute('d')).toContain('M3.8 3.4h8.4')
  })

  it('cade pe iconul de modul pentru un tip necunoscut', () => {
    const known = render(<OsIcon name="hub" />).container.querySelector('path')?.getAttribute('d')
    const unknown = render(<OsIcon name="ceva-inventat" />).container.querySelector('path')?.getAttribute('d')
    expect(unknown).toBe(known)
  })

  it('își ia culoarea de la butonul care îl poartă', () => {
    const { container } = render(<OsIcon name="goals" />)
    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
  })
})
