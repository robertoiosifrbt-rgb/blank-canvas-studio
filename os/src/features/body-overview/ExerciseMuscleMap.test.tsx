import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExerciseMuscleMap } from './ExerciseMuscleMap'

function shadesOf(container: HTMLElement, muscle: string) {
  const nodes = [...container.querySelectorAll(`[data-muscle="${muscle}"]`)]
  expect(nodes.length).toBeGreaterThan(0)
  return [...new Set(nodes.map((node) => node.getAttribute('data-level')))]
}

describe('ExerciseMuscleMap', () => {
  it('separates the primary muscles from the secondary ones', () => {
    const { container } = render(
      <ExerciseMuscleMap primaryMuscles="Chest" secondaryMuscles="Triceps" />,
    )

    expect(shadesOf(container, 'chest')).toEqual(['primary'])
    expect(shadesOf(container, 'triceps')).toEqual(['secondary'])
  })

  /*
   * The Body Overview's green and blue answer "what have you been neglecting".
   * On one exercise that question makes no sense — quads are not neglected by a
   * bench press, they are simply not part of it — so everything else is the
   * plain body colour.
   */
  it('leaves every other muscle neutral rather than green or blue', () => {
    const { container } = render(
      <ExerciseMuscleMap primaryMuscles="Chest" secondaryMuscles="" />,
    )

    expect(shadesOf(container, 'quads')).toEqual(['none'])
    expect(shadesOf(container, 'hamstrings')).toEqual(['none'])
  })

  it('lets primary win when a muscle is listed in both fields', () => {
    const { container } = render(
      <ExerciseMuscleMap primaryMuscles="Chest" secondaryMuscles="Chest, Triceps" />,
    )

    expect(shadesOf(container, 'chest')).toEqual(['primary'])
  })

  it('falls back to the exercise name when the fields are empty', () => {
    const { container } = render(
      <ExerciseMuscleMap primaryMuscles="" secondaryMuscles="" exerciseName="Calf raise" />,
    )

    expect(shadesOf(container, 'calves')).toEqual(['primary'])
  })

  /*
   * An exercise with nothing to show would render a blank grey body, which
   * takes up a card's worth of space to say nothing.
   */
  it('renders nothing when no muscle can be made out', () => {
    const { container } = render(
      <ExerciseMuscleMap primaryMuscles="" secondaryMuscles="" exerciseName="Warm-up" />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('tells a screen reader which muscles it is showing', () => {
    render(<ExerciseMuscleMap primaryMuscles="Chest" secondaryMuscles="Triceps" />)

    expect(screen.getByRole('img')).toHaveAccessibleName('Muscles worked: Chest, Triceps.')
  })

  it('drops the Front and Back captions at this size', () => {
    const { container } = render(<ExerciseMuscleMap primaryMuscles="Chest" secondaryMuscles="" />)

    expect(container.querySelector('.body-map-compact')).not.toBeNull()
  })
})
