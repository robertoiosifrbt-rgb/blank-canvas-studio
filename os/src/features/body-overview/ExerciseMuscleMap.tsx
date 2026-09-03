import { useMemo } from 'react'
import { BodyMap, type MuscleShade } from './BodyMap'
import { MUSCLES, parseMuscles, type MuscleId } from './muscles'

interface ExerciseMuscleMapProps {
  /** The exercise's `primaryMuscles` field, free text. */
  primaryMuscles: string
  /** The exercise's `secondaryMuscles` field, free text. */
  secondaryMuscles: string
  /** Falls back to reading muscles out of this when both fields are empty. */
  exerciseName?: string
}

/**
 * What one exercise trains, drawn on the body.
 *
 * The same figure as the Body Overview, reading the two free-text fields from
 * the library. Muscles the movement does not use stay the neutral body colour:
 * here the question is "what does this work", not "what have you been
 * neglecting", so the Overview's green and blue would be answering a question
 * nobody asked.
 *
 * Renders nothing when no muscle can be made out of the text — an empty body
 * says less than leaving the space to something else.
 */
export function ExerciseMuscleMap({
  primaryMuscles,
  secondaryMuscles,
  exerciseName = '',
}: ExerciseMuscleMapProps) {
  const { shades, worked } = useMemo(() => {
    let primary = parseMuscles(primaryMuscles)
    const secondary = parseMuscles(secondaryMuscles)
    if (primary.length === 0 && secondary.length === 0) primary = parseMuscles(exerciseName)

    const byMuscle = new Map<MuscleId, MuscleShade>()
    for (const muscle of secondary) byMuscle.set(muscle, 'secondary')
    // Primary wins if a muscle is somehow listed in both fields.
    for (const muscle of primary) byMuscle.set(muscle, 'primary')

    return { shades: byMuscle, worked: [...primary, ...secondary] }
  }, [primaryMuscles, secondaryMuscles, exerciseName])

  if (worked.length === 0) return null

  const summary = `Muscles worked: ${worked.map((id) => MUSCLES[id].label).join(', ')}.`

  return <BodyMap compact shadeFor={(muscle) => shades.get(muscle) ?? 'none'} summary={summary} />
}
