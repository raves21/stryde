import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NewRow } from '@/db/repositories/core'
import { localDateIn } from '@/lib/dates'
import { freshDb, signedInDb } from '@/test/local-db'
import type { StrydeDb } from '../db'
import { onLocalWrite } from './core'
import { createExercise, deleteExercise, updateExercise } from './exercises'
import {
  addSessionExercise,
  deleteSession,
  finishSession,
  listActiveSessions,
  startSession,
} from './sessions'
import { addSet, updateSet } from './sets'
import { getSettings, updateSettings } from './settings'
import { addTemplateExercise, addTemplateSet, createTemplate, deleteTemplate } from './templates'

const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'

function plannedSet(sessionExerciseId: string, position = 0): NewRow<'sets'> {
  return {
    sessionExerciseId,
    position,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: 8,
    targetRepsMax: null,
    targetRir: null,
    weightKg: 80,
    reps: null,
    rir: null,
    durationSec: null,
    completedAt: null,
  }
}

async function workout(db: StrydeDb, type: 'weighted' | 'timed' = 'weighted') {
  const exercise = await createExercise(
    { name: 'Press', type, muscleGroup: 'chest', equipment: 'barbell' },
    db,
  )
  const session = await startSession({ name: 'Workout' }, db)
  const se = await addSessionExercise(
    { sessionId: session.id, exerciseId: exercise.id, position: 0 },
    db,
  )
  const set = await addSet(plannedSet(se.id), db)
  return { exercise, session, se, set }
}

describe('repositories', () => {
  let db: StrydeDb
  afterEach(async () => {
    await db.delete()
  })

  it('writes the row and an outbox snapshot, owned by the signed-in user', async () => {
    db = await signedInDb(USER)
    const ex = await createExercise(
      { name: '  Landmine Press ', type: 'weighted', muscleGroup: 'shoulders', equipment: 'other' },
      db,
    )
    expect(ex).toMatchObject({
      userId: USER,
      name: 'Landmine Press',
      isPreset: false,
      deletedAt: null,
    })
    expect(ex.createdAt).toBe(ex.updatedAt)
    expect(await db.exercises.get(ex.id)).toEqual(ex)
    expect(await db.outbox.toArray()).toEqual([
      expect.objectContaining({ table: 'exercises', rowId: ex.id, row: ex }),
    ])
  })

  it('coalesces repeated edits of a row into one outbox entry with the latest snapshot', async () => {
    db = await signedInDb(USER)
    const { set } = await workout(db)
    const before = await db.outbox.where('[table+rowId]').equals(['sets', set.id]).first()
    await updateSet(set.id, { reps: 5 }, db)
    await updateSet(set.id, { reps: 8, completedAt: new Date().toISOString() }, db)
    const entries = await db.outbox.where('[table+rowId]').equals(['sets', set.id]).toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.row).toMatchObject({ reps: 8 })
    expect(entries[0]?.row).toEqual(await db.sets.get(set.id))
    // The coalesced entry moves to the end of the queue.
    expect(entries[0]?.seq).toBeGreaterThan(before?.seq ?? Number.POSITIVE_INFINITY)
    expect(await db.outbox.count()).toBe(4)
  })

  it('rolls back the row when the outbox write fails', async () => {
    db = await signedInDb(USER)
    db.outbox.hook('creating', () => {
      throw new Error('disk full')
    })
    await expect(
      createExercise(
        { name: 'Row', type: 'weighted', muscleGroup: 'back', equipment: 'cable' },
        db,
      ),
    ).rejects.toThrow('disk full')
    expect(await db.exercises.count()).toBe(0)
  })

  it('validates rows before writing anything', async () => {
    db = await signedInDb(USER)
    await expect(
      createExercise({ name: '', type: 'weighted', muscleGroup: 'back', equipment: 'cable' }, db),
    ).rejects.toThrow()
    expect(await db.exercises.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('requires a signed-in user', async () => {
    db = freshDb()
    await expect(createTemplate({ name: 'Push Day' }, db)).rejects.toThrow('No signed-in user')
  })

  it('notifies listeners after a committed write only', async () => {
    db = await signedInDb(USER)
    const listener = vi.fn()
    const stop = onLocalWrite(listener)
    await createTemplate({ name: 'Push Day' }, db)
    await createTemplate({ name: '' }, db).catch(() => {})
    stop()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('soft-deletes a session with its exercises and sets in one timestamp', async () => {
    db = await signedInDb(USER)
    const { session, se, set } = await workout(db)
    await deleteSession(session.id, db)
    const rows = [
      await db.sessions.get(session.id),
      await db.sessionExercises.get(se.id),
      await db.sets.get(set.id),
    ]
    const deletedAt = rows[0]?.deletedAt
    expect(deletedAt).toBeTruthy()
    expect(rows.map((r) => r?.deletedAt)).toEqual([deletedAt, deletedAt, deletedAt])
    const queued = await db.outbox.toArray()
    expect(
      queued
        .filter((e) => e.row.deletedAt === deletedAt)
        .map((e) => e.table)
        .sort(),
    ).toEqual(['sessionExercises', 'sessions', 'sets'])
  })

  it('soft-deletes a template with its exercises and sets', async () => {
    db = await signedInDb(USER)
    const { exercise } = await workout(db)
    const t = await createTemplate({ name: 'Push Day' }, db)
    const te = await addTemplateExercise(
      { templateId: t.id, exerciseId: exercise.id, position: 0 },
      db,
    )
    const ts = await addTemplateSet(
      {
        templateExerciseId: te.id,
        position: 0,
        setType: 'working',
        targetKind: 'rir',
        targetReps: 8,
        targetRepsMax: 12,
        targetRir: 2,
        plannedWeightKg: 60,
        plannedDurationSec: null,
      },
      db,
    )
    await deleteTemplate(t.id, db)
    expect((await db.templateExercises.get(te.id))?.deletedAt).toBeTruthy()
    expect((await db.templateSets.get(ts.id))?.deletedAt).toBeTruthy()
  })

  it('allows only one active session', async () => {
    db = await signedInDb(USER)
    const { session } = await workout(db)
    await expect(startSession({ name: 'Second' }, db)).rejects.toThrow('already active')
    await finishSession(session.id, db)
    await startSession({ name: 'Second' }, db)
    expect(await listActiveSessions(db)).toHaveLength(1)
  })

  it('records the calendar day in the session timezone', () => {
    const at = new Date('2026-10-28T20:30:00.000Z')
    expect(localDateIn(at, 'Asia/Manila')).toBe('2026-10-29')
    expect(localDateIn(at, 'America/New_York')).toBe('2026-10-28')
  })

  it('only completes sets that have the actuals their exercise type needs', async () => {
    db = await signedInDb(USER)
    const { set } = await workout(db, 'timed')
    const now = new Date().toISOString()
    await expect(updateSet(set.id, { reps: 1, completedAt: now }, db)).rejects.toThrow('duration')
    await updateSet(set.id, { durationSec: 90, completedAt: now }, db)
    expect((await db.sets.get(set.id))?.completedAt).toBe(now)
  })

  it('keeps preset exercises read-only', async () => {
    db = await signedInDb(USER)
    const preset = {
      id: '01a16d28-9e70-750e-917d-ccf0c6e2dfd5',
      userId: null,
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
      deletedAt: null,
      name: 'Bench Press',
      type: 'weighted' as const,
      muscleGroup: 'chest' as const,
      equipment: 'barbell' as const,
      defaultRestSeconds: 180,
      isPreset: true,
    }
    await db.exercises.put(preset)
    await expect(updateExercise(preset.id, { name: 'Mine' }, db)).rejects.toThrow('read-only')
    await expect(deleteExercise(preset.id, db)).rejects.toThrow('read-only')
    expect(await db.outbox.count()).toBe(0)
  })

  it('creates the settings row from defaults if it has not been pulled yet', async () => {
    db = await signedInDb(USER)
    await updateSettings({ unit: 'lb' }, db)
    expect(await getSettings(USER, db)).toMatchObject({
      id: USER,
      userId: USER,
      unit: 'lb',
      defaultRestSeconds: 120,
    })
    await updateSettings({ defaultRestSeconds: 90 }, db)
    expect(await getSettings(USER, db)).toMatchObject({ unit: 'lb', defaultRestSeconds: 90 })
    expect(await db.outbox.count()).toBe(1)
  })
})
