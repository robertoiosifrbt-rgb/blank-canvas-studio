import type { WorkoutEntry, WorkoutSession } from './types'

/*
 * Cele două cifre pe care le poartă un rând de sesiune: cât ai ridicat și cât
 * a durat.
 *
 * Erau scrise în `HomePage.tsx`, unde le folosea lista „Recent Workouts". Aici,
 * lângă modulul ale cărui date le citesc, pentru că jurnalul are nevoie de
 * exact aceleași cifre — iar a doua copie ar fi însemnat două definiții ale
 * „volumului", care se pot despărți pe tăcute.
 */

/**
 * Volumul unei sesiuni: suma `repetări × greutate` peste toate seturile.
 *
 * Numele câmpurilor sunt definite de utilizator, nu de noi, deci se caută mai
 * multe variante: `reps`/`rep`, `kg`/`weight`/`weightKg`. Un set fără greutate
 * (o tracțiune, un plank) contribuie cu zero, nu strică suma.
 */
export function sessionVolume(entries: WorkoutEntry[], sessionId: string): number {
  return entries
    .filter((entry) => entry.sessionId === sessionId)
    .reduce(
      (total, entry) =>
        total +
        entry.sets.reduce((setTotal, set) => {
          const reps = set.reps ?? set.rep ?? 0
          const weight = set.kg ?? set.weight ?? set.weightKg ?? 0
          return setTotal + reps * weight
        }, 0),
      0,
    )
}

/** Durata în secunde, sau 0 dacă sesiunea n-are un început și un sfârșit valide. */
export function sessionDurationSeconds(session: Pick<WorkoutSession, 'createdAt' | 'endedAt'>): number {
  if (!session.createdAt || !session.endedAt) return 0
  const start = new Date(session.createdAt).getTime()
  const end = new Date(session.endedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.floor((end - start) / 1000)
}

/**
 * `4223` → `1h 10m`. Rotunjit la minut: pe un rând de listă, secundele sunt
 * zgomot. Zero devine `—`, nu `0 min` — o sesiune neîncheiată n-are durată, iar
 * un zero ar arăta ca un antrenament de lungime nulă.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

/*
 * `formatVolume` a plecat în `shared/units.ts`: de când Settings poate cere
 * livre, formatarea are nevoie de sistemul de unități, iar acela e citit din
 * context, nu din datele antrenamentului. Volumul de aici rămâne în kg —
 * unitatea în care sunt salvate seturile.
 */
