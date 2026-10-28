import {
  countedSets,
  type DetectedPR,
  detectPRs,
  type ExerciseRow,
  sessionVolume,
} from '@stryde/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { getExerciseHistory, type SessionTree } from '@/db/repositories/sessions'

export type FinishSummary = {
  /** Completed working sets. */
  sets: number
  /** Total volume in kg. */
  volumeKg: number
  /** Exercises with at least one completed set. */
  exercises: number
  /** Sets that will be discarded on save. */
  incomplete: number
  prs: (DetectedPR & { exercise: ExerciseRow })[]
}

/** Stats and PRs for the finish sheet, all from `packages/shared/calc`. */
export function useFinishSummary(tree: SessionTree, enabled: boolean): FinishSummary | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return undefined
    let sets = 0
    let volumeKg = 0
    let exercises = 0
    let incomplete = 0
    const prs: FinishSummary['prs'] = []
    for (const { row, exercise, sets: rows } of tree.exercises) {
      sets += countedSets(rows).length
      volumeKg += sessionVolume(rows)
      if (rows.some((s) => s.completedAt !== null)) exercises += 1
      incomplete += rows.filter((s) => s.completedAt === null).length
      if (!exercise) continue
      const history = await getExerciseHistory(row.exerciseId, tree.session.id)
      for (const pr of detectPRs(exercise.type, history, rows)) prs.push({ ...pr, exercise })
    }
    return { sets, volumeKg, exercises, incomplete, prs }
  }, [tree, enabled])
}
