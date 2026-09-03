import { useMemo, useState } from 'react'
import { useExercises } from '../exercises'
import { useWorkoutLog } from '../workout-log/useWorkoutLog'
import { BodyMap } from './BodyMap'
import { BODY_PARTS, MUSCLES, MUSCLE_IDS, musclesByPart, type BodyPart, type MuscleId } from './muscles'
import {
  computeMuscleStats,
  LEVEL_COLORS,
  LEVEL_LABELS,
  PERIODS,
  shadeForShare,
  type MuscleLevel,
  type Period,
} from './muscleStats'
import './BodyOverview.css'

type MapMode = 'muscles' | 'parts'

const LEVEL_ORDER: MuscleLevel[] = ['primary', 'secondary', 'untargeted', 'notInvolved']

/** The strongest level among a set of muscles — how a whole body part is coloured. */
function bestLevel(levels: MuscleLevel[]): MuscleLevel {
  for (const level of LEVEL_ORDER) {
    if (levels.includes(level)) return level
  }
  return 'notInvolved'
}

export function BodyOverview() {
  const { entries } = useWorkoutLog()
  const { exercises } = useExercises()
  const [mode, setMode] = useState<MapMode>('muscles')
  const [period, setPeriod] = useState<Period>('week')

  const stats = useMemo(
    () => computeMuscleStats(entries, exercises, period),
    [entries, exercises, period],
  )

  const partLevels = useMemo(() => {
    const levels = {} as Record<BodyPart, MuscleLevel>
    for (const part of BODY_PARTS) {
      levels[part] = bestLevel(musclesByPart(part).map((id) => stats.byMuscle[id].level))
    }
    return levels
  }, [stats])

  const levelFor = (muscle: MuscleId): MuscleLevel =>
    mode === 'muscles' ? stats.byMuscle[muscle].level : partLevels[MUSCLES[muscle].part]

  const worked = MUSCLE_IDS.filter((id) => stats.byMuscle[id].level === 'primary')
  const summary = worked.length
    ? `Body map. Trained ${PERIODS.find((p) => p.value === period)?.label.toLowerCase()}: ${worked
        .map((id) => MUSCLES[id].label)
        .join(', ')}.`
    : 'Body map. Nothing logged for this period yet.'

  const maxFocus = stats.focus[0]?.sets ?? 0

  return (
    <section className="body-overview-page">
      <div className="body-mode-tabs" role="tablist" aria-label="Body map detail">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'muscles'}
          className={mode === 'muscles' ? 'active' : ''}
          onClick={() => setMode('muscles')}
        >
          Muscles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'parts'}
          className={mode === 'parts' ? 'active' : ''}
          onClick={() => setMode('parts')}
        >
          Body Parts
        </button>
      </div>

      <div className="body-map-card">
        <BodyMap shadeFor={levelFor} summary={summary} />

        <ul className="body-legend">
          {LEVEL_ORDER.map((level) => (
            <li key={level}>
              <span className="body-legend-dot" style={{ background: LEVEL_COLORS[level] }} />
              {LEVEL_LABELS[level]}
            </li>
          ))}
        </ul>
      </div>

      <div className="muscle-focus-card">
        <div className="muscle-focus-head">
          <h2>Muscle Focus</h2>
          <label className="muscle-focus-period">
            <span className="visually-hidden">Period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              {PERIODS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {stats.focus.length === 0 ? (
          <p className="muscle-focus-empty">
            No sets logged for this period. Finish a workout and your worked muscles show up here.
          </p>
        ) : (
          <ul className="muscle-focus-list">
            {stats.focus.map(({ part, sets }) => (
              <li key={part}>
                <span className="muscle-focus-name">{part}</span>
                <span className="muscle-focus-track">
                  <span
                    className="muscle-focus-bar"
                    data-part={part}
                    data-shade={shadeForShare(maxFocus ? sets / maxFocus : 0)}
                    style={{
                      width: `${maxFocus ? Math.round((sets / maxFocus) * 100) : 0}%`,
                      background: LEVEL_COLORS[shadeForShare(maxFocus ? sets / maxFocus : 0)],
                    }}
                  />
                </span>
                <span className="muscle-focus-sets">
                  {sets} {sets === 1 ? 'set' : 'sets'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
