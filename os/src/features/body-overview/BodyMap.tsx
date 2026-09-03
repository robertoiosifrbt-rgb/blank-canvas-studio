import type { MuscleId } from './muscles'
import { LEVEL_COLORS, type MuscleLevel } from './muscleStats'

/**
 * `none` is the neutral body colour. The Body Overview never uses it — there,
 * every muscle is at one of the four levels — but an exercise map does: on a
 * bench press, quads are simply not part of the movement, and coming out green
 * ("you skipped it") or blue ("nothing trains it") would say something false.
 */
export type MuscleShade = MuscleLevel | 'none'
import {
  ANTERIOR,
  BACK_VIEW_BOX,
  FRONT_VIEW_BOX,
  POSTERIOR,
  type BodyRegion,
  type BodyShape,
} from './bodyPolygons'

/**
 * Front and back body maps.
 *
 * The outlines are anatomical shapes (see `bodyPolygons.ts`), not something
 * assembled by hand — the hand-built version read as a snowman however much
 * its coordinates were nudged. Every region is a shape, hands and feet
 * included, so together they are the figure; there is no separate silhouette
 * to keep in step.
 *
 * Muscle polygons carry `data-muscle` and `data-level`, which is how the
 * colouring is tested. The drawing itself is checked by rendering it, not by a
 * test — see `docs/ARCHITECTURE.md`.
 */

/** Parts of the body that are not one of the muscles we track. */
const BODY_FILL = '#dfe4ec'
/** Outline around every region, so neighbouring muscles stay legible. */
const OUTLINE = '#9aa5b5'

/**
 * The source names regions its own way, and splits some of ours in two: front
 * and back deltoids are both our shoulders, and the soleus is part of the
 * calf. Regions with no muscle of ours — head, neck, knees, the
 * adductor/abductor bands — are structural: drawn, but never coloured by
 * training.
 */
const REGION_TO_MUSCLE: Record<BodyRegion, MuscleId | undefined> = {
  chest: 'chest',
  abs: 'abs',
  obliques: 'obliques',
  deltoids: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  trapezius: 'traps',
  'upper-back': 'lats',
  'lower-back': 'lowerBack',
  gluteal: 'glutes',
  quadriceps: 'quads',
  hamstring: 'hamstrings',
  calves: 'calves',
  // Structural, or muscles this app does not track: drawn, never coloured by
  // training. `tibialis` is the shin, the opposite of the calf, so it is not
  // folded into it.
  tibialis: undefined,
  adductors: undefined,
  knees: undefined,
  ankles: undefined,
  feet: undefined,
  hands: undefined,
  neck: undefined,
  head: undefined,
  hair: undefined,
}

interface FigureProps {
  view: 'front' | 'back'
  shadeFor: (muscle: MuscleId) => MuscleShade
}

function Figure({ view, shadeFor }: FigureProps) {
  const shapes: BodyShape[] = view === 'front' ? ANTERIOR : POSTERIOR

  return (
    <figure className="body-figure">
      <svg
        viewBox={view === 'front' ? FRONT_VIEW_BOX : BACK_VIEW_BOX}
        role="presentation"
        focusable="false"
      >
        <g stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
          {shapes.map((shape, index) => {
            const muscle = REGION_TO_MUSCLE[shape.region]
            if (!muscle) {
              return <path key={index} d={shape.d} fill={BODY_FILL} />
            }
            const shade = shadeFor(muscle)
            return (
              <path
                key={index}
                d={shape.d}
                fill={shade === 'none' ? BODY_FILL : LEVEL_COLORS[shade]}
                data-muscle={muscle}
                data-level={shade}
                data-view={view}
              />
            )
          })}
        </g>
      </svg>
      <figcaption>{view === 'front' ? 'Front' : 'Back'}</figcaption>
    </figure>
  )
}

interface BodyMapProps {
  shadeFor: (muscle: MuscleId) => MuscleShade
  /** Read out to a screen reader, which cannot use the drawing. */
  summary: string
  /** Thumbnail size, without the Front/Back captions — for use inside a card. */
  compact?: boolean
}

export function BodyMap({ shadeFor, summary, compact = false }: BodyMapProps) {
  return (
    <div className={`body-map ${compact ? 'body-map-compact' : ''}`} role="img" aria-label={summary}>
      <Figure view="front" shadeFor={shadeFor} />
      <Figure view="back" shadeFor={shadeFor} />
    </div>
  )
}
