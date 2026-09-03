export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'
  | 'biceps' | 'triceps' | 'forearms' | 'quadriceps' | 'hamstrings' | 'glutes' | 'calves'

export interface MuscleStats {
  muscle: MuscleGroup
  sets: number
  volume: number // kg
  intensity: 'primary' | 'secondary' | 'untargeted'
}

export const MUSCLE_COLORS = {
  primary: '#FF6B6B',
  secondary: '#FFA500',
  untargeted: '#E0E0E0',
} as const
