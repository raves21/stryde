import { afterEach, describe, expect, it } from 'vitest'
import { signedInDb } from '@/test/local-db'
import type { StrydeDb } from '../db'
import { createExercise } from './exercises'
import {
  addExerciseToSession,
  addSetToExercise,
  deleteSession,
  finishWorkout,
  getActiveSession,
  getSessionTree,
  removeFromSuperset,
  startEmptySession,
  startSessionFromTemplate,
  supersetWithNext,
} from './sessions'
import { removeSet, restoreSet, updateSet } from './sets'
import { updateSettings } from './settings'
import { addTemplateExercise, addTemplateSet, createTemplate } from './templates'

const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'

async function bench(db: StrydeDb) {
  return createExercise(
    { name: 'Bench', type: 'weighted', muscleGroup: 'chest', equipment: 'barbell' },
    db,
  )
}

/** Template: bench, 1 warm-up (fixed 10 @ 40) + 2 working (RIR 8–12 @2 at 80, failure). */
async function benchTemplate(db: StrydeDb, exerciseId: string) {
  const t = await createTemplate({ name: 'Push Day' }, db)
  const te = await addTemplateExercise(
    { templateId: t.id, exerciseId, position: 0, restSeconds: 150 },
    db,
  )
  const set = {
    templateExerciseId: te.id,
    targetRepsMax: null,
    targetRir: null,
    plannedDurationSec: null,
  }
  await addTemplateSet(
    {
      ...set,
      position: 0,
      setType: 'warmup',
      targetKind: 'fixed',
      targetReps: 10,
      plannedWeightKg: 40,
    },
    db,
  )
  await addTemplateSet(
    {
      ...set,
      position: 1,
      setType: 'working',
      targetKind: 'rir',
      targetReps: 8,
      targetRepsMax: 12,
      targetRir: 2,
      plannedWeightKg: 80,
    },
    db,
  )
  await addTemplateSet(
    {
      ...set,
      position: 2,
      setType: 'working',
      targetKind: 'failure',
      targetReps: null,
      plannedWeightKg: 80,
    },
    db,
  )
  return t
}

async function tree(db: StrydeDb, id: string) {
  const t = await getSessionTree(id, db)
  if (!t) throw new Error('no session')
  return t
}

const now = () => new Date().toISOString()

describe('workout repository', () => {
  let db: StrydeDb
  afterEach(async () => {
    await db.delete()
  })

  it('starts from a template, then pre-fills the next start from what was done', async () => {
    db = await signedInDb(USER)
    await updateSettings({ defaultShareWithFriends: false }, db)
    const ex = await bench(db)
    const t = await benchTemplate(db, ex.id)

    const first = await startSessionFromTemplate(t.id, db)
    expect(first).toMatchObject({
      name: 'Push Day',
      templateId: t.id,
      finishedAt: null,
      shareWithFriends: false,
    })
    let w = await tree(db, first.id)
    const [warm, rir, fail] = w.exercises[0]?.sets ?? []
    expect([warm, rir, fail].map((s) => [s?.weightKg, s?.reps, s?.rir])).toEqual([
      [40, 10, null],
      [80, null, 2],
      [80, null, 0],
    ])
    expect(w.exercises[0]?.row.restSeconds).toBe(150)
    expect(w.exercises[0]?.previous).toEqual([undefined, undefined, undefined])

    // Log it: heavier than planned.
    await updateSet(warm?.id ?? '', { weightKg: 45, completedAt: now() }, db)
    await updateSet(rir?.id ?? '', { weightKg: 85, reps: 9, rir: 1, completedAt: now() }, db)
    await updateSet(fail?.id ?? '', { weightKg: 82.5, reps: 7, completedAt: now() }, db)
    await finishWorkout(first.id, { notes: 'Felt strong', shareWithFriends: false }, db)

    const second = await startSessionFromTemplate(t.id, db)
    w = await tree(db, second.id)
    expect(w.exercises[0]?.sets.map((s) => [s.weightKg, s.reps, s.rir])).toEqual([
      [45, 10, null],
      [85, null, 2],
      [82.5, null, 0],
    ])
    expect(w.exercises[0]?.previous.map((p) => p && [p.weightKg, p.reps, p.rir])).toEqual([
      [45, 10, null],
      [85, 9, 1],
      [82.5, 7, 0],
    ])
  })

  it('allows only one active workout', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const t = await benchTemplate(db, ex.id)
    await startEmptySession(db)
    await expect(startSessionFromTemplate(t.id, db)).rejects.toThrow('already active')
    expect((await getActiveSession(db))?.name).toBe('Workout')
  })

  it('finishing discards incomplete sets and exercises left empty', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const other = await createExercise(
      { name: 'Row', type: 'weighted', muscleGroup: 'back', equipment: 'cable' },
      db,
    )
    const s = await startEmptySession(db)
    const se = await addExerciseToSession(s.id, ex.id, db)
    await addExerciseToSession(s.id, other.id, db)
    const extra = await addSetToExercise(se.id, db)
    const [done] = (await tree(db, s.id)).exercises[0]?.sets ?? []
    await updateSet(done?.id ?? '', { weightKg: 60, reps: 5, completedAt: now() }, db)

    await finishWorkout(s.id, { notes: null, shareWithFriends: true }, db)
    const w = await tree(db, s.id)
    expect(w.session.finishedAt).not.toBeNull()
    expect(
      w.exercises.map((e) => [e.exercise?.name, e.row.position, e.sets.map((x) => x.id)]),
    ).toEqual([['Bench', 0, [done?.id]]])
    expect((await db.sets.get(extra.id))?.deletedAt).toBeTruthy()
  })

  it('adds a set copying the last one and pre-filling its weight', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const s = await startEmptySession(db)
    const se = await addExerciseToSession(s.id, ex.id, db)
    const [first] = (await tree(db, s.id)).exercises[0]?.sets ?? []
    await updateSet(first?.id ?? '', { targetKind: 'failure', rir: 0, weightKg: 70 }, db)
    const next = await addSetToExercise(se.id, db)
    expect(next).toMatchObject({
      position: 1,
      setType: 'working',
      targetKind: 'failure',
      weightKg: 70,
      reps: null,
      rir: 0,
    })
  })

  it('supersets with the next exercise and back out', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const s = await startEmptySession(db)
    const a = await addExerciseToSession(s.id, ex.id, db)
    const b = await addExerciseToSession(s.id, ex.id, db)
    const c = await addExerciseToSession(s.id, ex.id, db)
    await supersetWithNext(a.id, db)
    await supersetWithNext(b.id, db)
    const groups = async () =>
      (await tree(db, s.id)).exercises.map((e) => [e.row.id, e.row.supersetGroup])
    expect(await groups()).toEqual([
      [a.id, 'A'],
      [b.id, 'A'],
      [c.id, 'A'],
    ])
    // Taking the middle one out moves it after the group instead of splitting it.
    await removeFromSuperset(b.id, db)
    expect(await groups()).toEqual([
      [a.id, 'A'],
      [c.id, 'A'],
      [b.id, null],
    ])
  })

  it('restores a deleted set (undo)', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const s = await startEmptySession(db)
    await addExerciseToSession(s.id, ex.id, db)
    const [set] = (await tree(db, s.id)).exercises[0]?.sets ?? []
    await removeSet(set?.id ?? '', db)
    expect((await tree(db, s.id)).exercises[0]?.sets).toHaveLength(0)
    await restoreSet(set?.id ?? '', db)
    expect((await tree(db, s.id)).exercises[0]?.sets.map((x) => x.id)).toEqual([set?.id])
    const entry = await db.outbox
      .where('[table+rowId]')
      .equals(['sets', set?.id ?? ''])
      .first()
    expect(entry?.row.deletedAt).toBeNull()
  })

  it('discarding soft-deletes the whole workout', async () => {
    db = await signedInDb(USER)
    const ex = await bench(db)
    const s = await startEmptySession(db)
    await addExerciseToSession(s.id, ex.id, db)
    await deleteSession(s.id, db)
    expect(await getActiveSession(db)).toBeUndefined()
    expect(await getSessionTree(s.id, db)).toBeUndefined()
  })
})
