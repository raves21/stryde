import type { ExerciseRow } from '@stryde/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { getExercise, listExercises, listRecentExerciseIds } from '@/db/repositories/exercises'

/** Presets and the user's own exercises, by name (live). */
export function useExercises(): ExerciseRow[] | undefined {
  return useLiveQuery(() => listExercises(), [])
}

export function useExercise(id: string): ExerciseRow | null | undefined {
  // null = loaded but missing/archived; undefined = still loading.
  return useLiveQuery(async () => (await getExercise(id)) ?? null, [id])
}

export function useRecentExerciseIds(): string[] {
  return useLiveQuery(() => listRecentExerciseIds(), [], [])
}
