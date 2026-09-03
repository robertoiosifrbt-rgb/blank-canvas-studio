import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BodyOverview } from './BodyOverview'
import { todayLocal } from '../../shared/localDate'

const EXERCISES_KEY = 'gym-app:exercises'
const LOG_KEY = 'gym-app:workout-log'

const BENCH = {
  id: 'ex-bench',
  name: 'Barbell Bench Press',
  fields: ['reps', 'kg'],
  category: 'Chest',
  difficulty: '',
  equipment: 'Barbell',
  primaryMuscles: 'Chest',
  secondaryMuscles: 'Shoulders, Triceps',
  instructions: '',
}

const SQUAT = { ...BENCH, id: 'ex-squat', name: 'Back Squat', primaryMuscles: 'Quads', secondaryMuscles: 'Glutes' }

function seedLog(date = todayLocal()) {
  localStorage.setItem(
    LOG_KEY,
    JSON.stringify([
      {
        id: 'e1',
        sessionId: 's1',
        date,
        exerciseId: BENCH.id,
        exerciseName: BENCH.name,
        sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
      },
    ]),
  )
}

/**
 * The level every polygon of a muscle is drawn at, deduplicated. A muscle can
 * be several polygons — left and right, and the calf is split into calf and
 * soleus — so this asserts what they agree on rather than how many there are.
 */
function levelsOf(container: HTMLElement, muscle: string) {
  const nodes = [...container.querySelectorAll(`[data-muscle="${muscle}"]`)]
  expect(nodes.length).toBeGreaterThan(0)
  return [...new Set(nodes.map((node) => node.getAttribute('data-level')))]
}

beforeEach(() => {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify([BENCH, SQUAT]))
})

describe('BodyOverview', () => {
  it('draws a front and a back figure', () => {
    const { container } = render(<BodyOverview />)

    expect(screen.getByText('Front')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-view="front"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-view="back"]').length).toBeGreaterThan(0)
  })

  it('names all four states in the legend', () => {
    render(<BodyOverview />)

    for (const label of ['Primary', 'Secondary', 'Untargeted', 'Not Involved']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('colours the muscles an exercise trains', () => {
    seedLog()
    const { container } = render(<BodyOverview />)

    expect(levelsOf(container, 'chest')).toEqual(['primary'])
    expect(levelsOf(container, 'triceps')).toEqual(['secondary'])
    // The arm was worked — through the triceps — but the biceps were skipped.
    expect(levelsOf(container, 'biceps')).toEqual(['untargeted'])
    // Nothing this week went near the legs.
    expect(levelsOf(container, 'quads')).toEqual(['notInvolved'])
    expect(levelsOf(container, 'hamstrings')).toEqual(['notInvolved'])
  })

  /*
   * Two groups, 4 sets against 1. The smaller one is a quarter of the bigger,
   * so it steps down the scale instead of coming out red like everything else.
   */
  it('cools the bar of a group you barely touched', () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: 'a', sessionId: 's1', date: todayLocal(), exerciseId: BENCH.id, exerciseName: BENCH.name, sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }] },
        { id: 'b', sessionId: 's1', date: todayLocal(), exerciseId: SQUAT.id, exerciseName: SQUAT.name, sets: [{ reps: 5 }] },
      ]),
    )
    const { container } = render(<BodyOverview />)

    const bars = [...container.querySelectorAll('.muscle-focus-bar')]
    expect(bars.map((bar) => bar.getAttribute('data-part'))).toEqual(['Chest', 'Legs'])
    expect(bars.map((bar) => bar.getAttribute('data-shade'))).toEqual(['primary', 'untargeted'])
  })

  it('lists the worked body parts with their set counts', () => {
    seedLog()
    render(<BodyOverview />)

    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getAllByText('3 sets').length).toBeGreaterThan(0)
  })

  /*
   * Counting secondary sets in the focus list made arms the biggest number on
   * screen: a bench press names triceps as secondary, so every chest set was
   * also an arm set. The map still shows that work in amber.
   */
  it('leaves secondary work out of the focus list', () => {
    seedLog()
    render(<BodyOverview />)

    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.queryByText('Arms')).not.toBeInTheDocument()
    expect(screen.queryByText('Shoulders')).not.toBeInTheDocument()
  })

  /*
   * The body is drawn entirely from anatomical shapes, so the parts that are
   * not muscles we track — head, hands, feet, knees — still have to be drawn,
   * or the figure comes out with holes in it.
   */
  it('draws the structural parts of the body too', () => {
    const { container } = render(<BodyOverview />)

    const all = container.querySelectorAll('svg path')
    const muscles = container.querySelectorAll('svg path[data-muscle]')
    expect(muscles.length).toBeGreaterThan(0)
    expect(all.length).toBeGreaterThan(muscles.length)
  })

  /*
   * Body Parts is the coarse view: one colour per region, so a muscle takes
   * the level of the strongest muscle it shares a part with. Biceps were not
   * trained, but triceps were, so the whole arm reads as worked.
   */
  it('colours whole regions in the Body Parts view', () => {
    seedLog()
    const { container } = render(<BodyOverview />)

    expect(levelsOf(container, 'biceps')).toEqual(['untargeted'])

    fireEvent.click(screen.getByRole('tab', { name: 'Body Parts' }))

    expect(levelsOf(container, 'biceps')).toEqual(['secondary'])
    expect(levelsOf(container, 'triceps')).toEqual(['secondary'])
  })

  it('starts on the Muscles view', () => {
    render(<BodyOverview />)

    expect(screen.getByRole('tab', { name: 'Muscles' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Body Parts' })).toHaveAttribute('aria-selected', 'false')
  })

  it('changes what counts when the period changes', () => {
    seedLog('2020-01-06')
    const { container } = render(<BodyOverview />)

    expect(levelsOf(container, 'chest')).toEqual(['notInvolved'])
    expect(screen.getByText(/No sets logged for this period/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'all' } })

    expect(levelsOf(container, 'chest')).toEqual(['primary'])
    expect(screen.queryByText(/No sets logged for this period/)).not.toBeInTheDocument()
  })

  it('tells a screen reader what the drawing shows', () => {
    seedLog()
    render(<BodyOverview />)

    expect(screen.getByRole('img')).toHaveAccessibleName(/Chest/)
  })

  it('says so plainly when nothing has been logged', () => {
    render(<BodyOverview />)

    expect(screen.getByText(/No sets logged for this period/)).toBeInTheDocument()
  })
})
