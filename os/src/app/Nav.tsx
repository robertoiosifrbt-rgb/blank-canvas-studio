import type { Page } from './App'

interface NavProps {
  current: Page
  onNavigate: (page: Page) => void
}

function NavIcon({ type }: { type: Page }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'home') return <svg {...common}><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>
  if (type === 'body') return <svg {...common}><path d="M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/><path d="M8.5 21v-5.5L6 12l2.5-2h7l2.5 2-2.5 3.5V21"/><path d="M12 9v7"/></svg>
  if (type === 'workout') return <svg {...common}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
  if (type === 'progress') return <svg {...common}><path d="M5 19V10M12 19V5M19 19v-7"/><path d="M3 19h18"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06A1.7 1.7 0 0 0 15.74 19.4 1.7 1.7 0 0 0 14 21h-4a1.7 1.7 0 0 0-1.74-1.6A1.7 1.7 0 0 0 6.38 19l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 13.26v-2.52A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 8.26 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1.74 1.6A1.7 1.7 0 0 0 17.62 5l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10.74v2.52A1.7 1.7 0 0 0 19.4 15Z"/></svg>
}

const pages: Array<{ key: Page; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'body', label: 'Body' },
  { key: 'workout', label: 'Workout' },
  { key: 'progress', label: 'Progress' },
  { key: 'settings', label: 'Settings' },
]

export function Nav({ current, onNavigate }: NavProps) {
  return <nav className="bottom-nav target-bottom-nav" aria-label="Main navigation">
    {pages.map(({ key, label }) => <button key={key} type="button" className={key === current ? 'active' : ''} onClick={() => onNavigate(key)} aria-current={key === current ? 'page' : undefined} aria-label={label}><span className="nav-icon" aria-hidden="true"><NavIcon type={key}/></span><span className="nav-label">{label}</span></button>)}
  </nav>
}
