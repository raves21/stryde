import type { ExerciseRow } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type RowPatch, type Writer } from './core'

export type NewExercise = Pick<ExerciseRow, 'name' | 'type' | 'muscleGroup' | 'equipment'> & {
  defaultRestSeconds?: number | null
}

export function createExercise(input: NewExercise, db: StrydeDb = defaultDb) {
  return mutate(
    ['exercises'],
    (w) =>
      w.insert('exercises', {
        ...input,
        defaultRestSeconds: input.defaultRestSeconds ?? null,
        isPreset: false,
      }),
    db,
  )
}

export function updateExercise(
  id: string,
  patch: Omit<RowPatch<'exercises'>, 'isPreset'>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    ['exercises'],
    async (w) => {
      await assertCustom(w, id)
      return w.update('exercises', id, patch)
    },
    db,
  )
}

export function deleteExercise(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    ['exercises'],
    async (w) => {
      await assertCustom(w, id)
      await w.softDelete('exercises', [id])
    },
    db,
  )
}

async function assertCustom(w: Writer, id: string) {
  const row = await w.get('exercises', id)
  if (row?.isPreset) throw new Error('Preset exercises are read-only')
}

/** Presets and the user's own exercises, by name. */
export function listExercises(db: StrydeDb = defaultDb): Promise<ExerciseRow[]> {
  return db.exercises.filter((e) => !e.deletedAt).sortBy('name')
}

export async function getExercise(id: string, db: StrydeDb = defaultDb) {
  const row = await db.exercises.get(id)
  return row && !row.deletedAt ? row : undefined
}

/** Exercise ids from the most recent sessions, newest first, without duplicates. */
export async function listRecentExerciseIds(
  limit = 5,
  db: StrydeDb = defaultDb,
): Promise<string[]> {
  const recent = await db.sessionExercises.orderBy('id').reverse().limit(200).toArray()
  const ids: string[] = []
  for (const se of recent) {
    if (se.deletedAt || ids.includes(se.exerciseId)) continue
    ids.push(se.exerciseId)
    if (ids.length === limit) break
  }
  return ids
}
