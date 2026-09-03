import type { ReactNode } from 'react'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  /** Small line under the title — a count, a date. Omitted on most screens. */
  subtitle?: string
  /**
   * `center` is the norm in the visual target; `left` is the larger treatment
   * the mockup gives the two list roots, Exercises and Settings.
   */
  align?: 'center' | 'left'
  /** Single control on the right, e.g. the `+` on Progress Photos. */
  action?: ReactNode
}

/**
 * The title strip every screen starts with.
 *
 * Replaces three near-identical headers that had drifted to three different
 * title sizes (1.8rem, 1.34rem, 1.28rem). The app has no global header bar —
 * no screen in the visual target has one — so this is the top of the page.
 */
export function PageHeader({ title, subtitle, align = 'center', action }: PageHeaderProps) {
  return (
    <header className={`page-header page-header-${align}`}>
      <div className="page-header-copy">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}
