import './NotBuilt.css'

type Props = {
  /** What will live on this screen, in the words of the plan. */
  children: string
}

/**
 * Says the screen is not built yet, without showing invented data.
 * It disappears at step 5, when the screens hold real data.
 */
export function NotBuilt({ children }: Props) {
  return (
    <section className="not-built">
      <p className="not-built-text">{children}</p>
      <p className="not-built-state">
        There is no data layer wired up yet. Nothing is saved on this screen.
      </p>
    </section>
  )
}
