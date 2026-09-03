import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Exercises" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Exercises' })).toBeInTheDocument()
  })

  it('leaves out the subtitle line when there is nothing to say', () => {
    const { container } = render(<PageHeader title="Settings" />)

    expect(container.querySelector('.page-header p')).toBeNull()
  })

  it('shows the subtitle when given one', () => {
    render(<PageHeader title="Exercises" subtitle="3 exercises in your library" />)

    expect(screen.getByText('3 exercises in your library')).toBeInTheDocument()
  })

  it('carries an action next to the title', () => {
    render(<PageHeader title="Progress Photos" action={<button type="button">Add</button>} />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('is centred unless asked for the left treatment', () => {
    const { container, rerender } = render(<PageHeader title="Body Overview" />)
    expect(container.querySelector('.page-header-center')).not.toBeNull()

    rerender(<PageHeader title="Exercises" align="left" />)
    expect(container.querySelector('.page-header-left')).not.toBeNull()
  })
})
