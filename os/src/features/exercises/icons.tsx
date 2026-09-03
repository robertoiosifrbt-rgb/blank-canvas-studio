/*
 * Cele două iconițe ale ecranului Exercises.
 *
 * Într-un fișier separat, nu în pagină: lista are nevoie de steluță, iar dacă
 * o importa din `ExercisesPage` — care importă lista — ar ieși un ciclu. Merge
 * și așa, fiindcă declarațiile de funcții se ridică, dar e genul de lucru care
 * se rupe fără motiv aparent la prima reorganizare.
 */

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

/** Conturată când nu e favorit, plină când e — aceeași formă, ca să nu sară. */
export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
    </svg>
  )
}
