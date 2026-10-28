import type { Equipment, ExerciseType, MuscleGroup } from '@stryde/shared'

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  full_body: 'Full body',
  cardio: 'Cardio',
  other: 'Other',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  smith: 'Smith machine',
  other: 'Other',
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weighted: 'Weighted',
  bodyweight: 'Bodyweight',
  timed: 'Timed',
}

/** Rest choices in seconds (0:30 – 5:00). */
export const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

/** 90 → "1:30". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
