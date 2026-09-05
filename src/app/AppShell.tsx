import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { CaptureSheet } from '../items/CaptureSheet'
import { ItemSheet } from '../items/ItemSheet'
import type { ScreenContext } from '../items/context'
import { useItems } from '../items/useItems'
import { signOut } from '../repository/auth'
import { localToday } from '../repository/items'
import type { Session } from '../repository/auth'
import { ShellHeader } from './ShellHeader'
import { SCREENS } from './screens'
import './AppShell.css'

type Props = { session: Session }

export function AppShell({ session }: Props) {
  const location = useLocation()
  const current = SCREENS.find((screen) => screen.path === location.pathname)
  const data = useItems(session.userId)

  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  // Looked up fresh every render, so the sheet never shows a stale version. If
  // the item is gone, the sheet closes itself with it.
  const openItem = data.items.find((item) => item.id === openId) ?? null
  const today = localToday(new Date())

  function report(body: () => Promise<unknown>) {
    setError(null)
    void body().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const context: ScreenContext = {
    data,
    openItem: (item) => setOpenId(item.id),
    today,
  }

  return (
    <div className="shell">
      <ShellHeader
        title={current?.label ?? 'Life Control Centre'}
        email={session.email}
        sync={data.sync}
        onResync={data.resync}
        onDownload={() => report(() => data.download())}
        onSignOut={() => report(signOut)}
        error={error}
      />

      <main className="shell-body">
        <Outlet context={context} />
      </main>

      {/* Stuck to the bottom, where the thumb already is. The thing that has
          to be easiest is putting something in. */}
      <div className="shell-bottom">
        <button
          className="shell-capture"
          type="button"
          name="capture"
          onClick={() => setCapturing(true)}
        >
          Write a line
        </button>

        <nav className="shell-nav" aria-label="Screens">
          {SCREENS.map((screen) => (
            <NavLink key={screen.path} to={screen.path} className="shell-nav-button">
              {screen.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {capturing && (
        <CaptureSheet
          onSave={(title) => data.capture(title)}
          onClose={() => setCapturing(false)}
        />
      )}

      {openItem !== null && (
        <ItemSheet
          item={openItem}
          today={today}
          unsaved={data.unsaved.find((u) => u.item.id === openItem.id)?.reason}
          onUpdate={data.update}
          onDiscard={data.discard}
          onRetry={(item) => data.retry(item.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
