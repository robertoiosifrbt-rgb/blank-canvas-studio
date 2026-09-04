import './Neconstruit.css'

type Props = {
  /** Ce va sta pe acest ecran, spus în cuvintele planului. */
  children: string
}

/**
 * Spune că ecranul nu e construit încă, fără să arate date inventate.
 * Dispare la pasul 5, când ecranele țin date adevărate.
 */
export function Neconstruit({ children }: Props) {
  return (
    <section className="neconstruit">
      <p className="neconstruit-text">{children}</p>
      <p className="neconstruit-stare">
        Nu există încă strat de date. Nimic nu se salvează pe acest ecran.
      </p>
    </section>
  )
}
