import { type SetRow, setCompletionError } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type NewRow, type RowPatch, type Writer } from './core'

const TABLES = ['sets', 'sessionExercises', 'exercises'] as const

export function addSet(input: NewRow<'sets'>, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      await assertCompletable(w, input)
      return w.insert('sets', input)
    },
    db,
  )
}

/** Patch a set; completing it requires the actuals its exercise type needs. */
export function updateSet(id: string, patch: RowPatch<'sets'>, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const existing = await w.get('sets', id)
      if (!existing) throw new Error(`sets ${id} not found`)
      await assertCompletable(w, { ...existing, ...patch })
      return w.update('sets', id, patch)
    },
    db,
  )
}

export function removeSet(id: string, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.softDelete('sets', [id]), db)
}

async function assertCompletable(
  w: Writer,
  set: Omit<SetRow, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
) {
  if (set.completedAt === null) return
  const sessionExercise = await w.get('sessionExercises', set.sessionExerciseId)
  const exercise = sessionExercise && (await w.db.exercises.get(sessionExercise.exerciseId))
  if (!exercise) throw new Error('Set has no exercise')
  const error = setCompletionError(set, exercise.type)
  if (error) throw new Error(error)
}

export async function getSets(
  sessionExerciseId: string,
  db: StrydeDb = defaultDb,
): Promise<SetRow[]> {
  const rows = await db.sets
    .where('[sessionExerciseId+position]')
    .between([sessionExerciseId, -Infinity], [sessionExerciseId, Infinity])
    .toArray()
  return rows.filter((r) => !r.deletedAt)
}
