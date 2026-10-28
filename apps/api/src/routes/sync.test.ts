import type { PullResponse, PushResponse, SyncChange } from '@stryde/shared'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, db } from '../db/client'
import { sets as setsTable } from '../db/schema'
import { PRESET_EXERCISES } from '../db/seed/exercises'
import { MAX_CLOCK_SKEW_MS } from '../services/sync'
import { get, hasDatabase, postJson, signUpUser } from '../test/helpers'

// Sync protocol cases from DATA_MODEL_AND_SYNC.md §8, against a real Postgres.

const preset = (name: string) => {
  const p = PRESET_EXERCISES.find((e) => e.name === name)
  if (!p) throw new Error(`no preset ${name}`)
  return p.id
}
const BENCH = preset('Bench Press')
const PLANK = preset('Plank')

const iso = (ms: number) => new Date(ms).toISOString()
// An hour ago, so test timestamps sit inside the server's clock-skew clamp.
const T0 = Date.now() - 3600_000

function common(userId: string, at = T0) {
  return { id: uuidv7(), userId, createdAt: iso(at), updatedAt: iso(at), deletedAt: null }
}

function sessionRow(userId: string, over: Record<string, unknown> = {}) {
  return {
    ...common(userId),
    templateId: null,
    name: 'Workout',
    startedAt: iso(T0),
    finishedAt: null,
    timezone: 'Asia/Manila',
    localDate: '2026-10-28',
    notes: null,
    shareWithFriends: true,
    ...over,
  }
}

function sessionExerciseRow(userId: string, sessionId: string, over: Record<string, unknown> = {}) {
  return {
    ...common(userId),
    sessionId,
    exerciseId: BENCH,
    position: 0,
    supersetGroup: null,
    restSeconds: null,
    ...over,
  }
}

function setRow(userId: string, sessionExerciseId: string, over: Record<string, unknown> = {}) {
  return {
    ...common(userId),
    sessionExerciseId,
    position: 0,
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
    ...over,
  }
}

type Mutation = { table: SyncChange['table']; row: Record<string, unknown> }

async function push(cookie: string, mutations: Mutation[]) {
  const res = await postJson('/api/sync/push', { clientId: uuidv7(), mutations }, cookie)
  expect(res.status).toBe(200)
  return ((await res.json()) as PushResponse).results
}

async function pullAll(cookie: string, cursor = '0', limit = 1000) {
  const changes: PullResponse['changes'] = []
  let next = cursor
  for (;;) {
    const res = await get(`/api/sync/pull?cursor=${next}&limit=${limit}`, cookie)
    expect(res.status).toBe(200)
    const body = (await res.json()) as PullResponse
    changes.push(...body.changes)
    next = body.cursor
    if (!body.hasMore) return { changes, cursor: next }
  }
}

function rowsOf(changes: PullResponse['changes'], table: string) {
  return changes.filter((c) => c.table === table).map((c) => c.row)
}

function find(changes: PullResponse['changes'], table: string, id: unknown) {
  return rowsOf(changes, table).find((r) => r.id === id)
}

/** A session with one exercise and one set, pushed. */
async function seedWorkout(cookie: string, userId: string) {
  const s = sessionRow(userId)
  const se = sessionExerciseRow(userId, s.id)
  const set = setRow(userId, se.id)
  await push(cookie, [
    { table: 'sessions', row: s },
    { table: 'sessionExercises', row: se },
    { table: 'sets', row: set },
  ])
  return { s, se, set }
}

describe.skipIf(!hasDatabase)('sync', () => {
  let a: { cookie: string; userId: string }
  let b: { cookie: string; userId: string }

  beforeAll(async () => {
    a = await signUpUser()
    b = await signUpUser()
  })
  afterAll(() => client.end())

  it('requires a session', async () => {
    expect((await postJson('/api/sync/push', { clientId: uuidv7(), mutations: [] })).status).toBe(
      401,
    )
    expect((await get('/api/sync/pull')).status).toBe(401)
  })

  it('rejects malformed requests', async () => {
    const tooMany = Array(201).fill({ table: 'sets', row: {} })
    const res = await postJson(
      '/api/sync/push',
      { clientId: uuidv7(), mutations: tooMany },
      a.cookie,
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_request' } })
    expect((await get('/api/sync/pull?cursor=abc', a.cookie)).status).toBe(400)
  })

  it('initial pull returns presets and the settings row, without serverVersion', async () => {
    const { changes } = await pullAll(a.cookie)
    const presets = rowsOf(changes, 'exercises').filter((r) => r.isPreset)
    expect(presets).toHaveLength(PRESET_EXERCISES.length)
    expect(presets.every((r) => r.userId === null)).toBe(true)
    expect(rowsOf(changes, 'userSettings')).toEqual([
      expect.objectContaining({ id: a.userId, userId: a.userId, unit: 'kg' }),
    ])
    expect(changes.every((c) => !('serverVersion' in c.row))).toBe(true)
  })

  it('round-trips rows and forces userId from the session', async () => {
    const s = sessionRow(b.userId) // a claims to write b's row
    const results = await push(a.cookie, [{ table: 'sessions', row: s }])
    expect(results).toEqual([{ table: 'sessions', id: s.id, status: 'applied' }])
    const { changes } = await pullAll(a.cookie)
    expect(find(changes, 'sessions', s.id)).toEqual({ ...s, userId: a.userId })
    expect(find((await pullAll(b.cookie)).changes, 'sessions', s.id)).toBeUndefined()
  })

  it('last write wins in both directions', async () => {
    const { set } = await seedWorkout(a.cookie, a.userId)
    const newer = { ...set, reps: 8, completedAt: iso(T0 + 2000), updatedAt: iso(T0 + 2000) }
    const older = { ...set, reps: 5, completedAt: iso(T0 + 1000), updatedAt: iso(T0 + 1000) }

    expect(await push(a.cookie, [{ table: 'sets', row: newer }])).toMatchObject([
      { status: 'applied' },
    ])
    expect(await push(a.cookie, [{ table: 'sets', row: older }])).toMatchObject([
      { status: 'ignored_stale' },
    ])
    expect(find((await pullAll(a.cookie)).changes, 'sets', set.id)).toMatchObject({ reps: 8 })
  })

  it('replaying the same mutation is idempotent', async () => {
    const s = sessionRow(a.userId)
    const first = await push(a.cookie, [{ table: 'sessions', row: s }])
    const again = await push(a.cookie, [{ table: 'sessions', row: s }])
    expect(first).toEqual(again)
    const matches = rowsOf((await pullAll(a.cookie)).changes, 'sessions').filter(
      (r) => r.id === s.id,
    )
    expect(matches).toEqual([{ ...s, userId: a.userId }])
  })

  it('accepts a child before its parent in one batch', async () => {
    const s = sessionRow(a.userId)
    const se = sessionExerciseRow(a.userId, s.id)
    const set = setRow(a.userId, se.id)
    const results = await push(a.cookie, [
      { table: 'sets', row: set },
      { table: 'sessionExercises', row: se },
      { table: 'sessions', row: s },
    ])
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied'])
  })

  it('tombstones children when the session is deleted, including sets added later', async () => {
    const { s, se, set } = await seedWorkout(a.cookie, a.userId)
    const deletedAt = iso(T0 + 60_000)
    // Device A deletes the session.
    await push(a.cookie, [{ table: 'sessions', row: { ...s, deletedAt, updatedAt: deletedAt } }])
    // Device B, offline, added a set to the same exercise and a new exercise with a set.
    const lateSet = setRow(a.userId, se.id, { position: 1, updatedAt: iso(T0 + 120_000) })
    const lateSe = sessionExerciseRow(a.userId, s.id, { position: 1 })
    const lateSeSet = setRow(a.userId, lateSe.id)
    const results = await push(a.cookie, [
      { table: 'sets', row: lateSet },
      { table: 'sessionExercises', row: lateSe },
      { table: 'sets', row: lateSeSet },
    ])
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied'])

    const { changes } = await pullAll(a.cookie)
    expect(find(changes, 'sessions', s.id)?.deletedAt).toBe(deletedAt)
    for (const [table, id] of [
      ['sessionExercises', se.id],
      ['sets', set.id],
      ['sets', lateSet.id],
      ['sessionExercises', lateSe.id],
      ['sets', lateSeSet.id],
    ] as const) {
      const row = find(changes, table, id)
      expect(row?.deletedAt, `${table} ${id}`).toBe(deletedAt)
    }
    // The cascaded row's updatedAt never goes backwards, so device B applies it.
    expect(Date.parse(String(find(changes, 'sets', lateSet.id)?.updatedAt))).toBe(T0 + 120_000)
  })

  it('tombstones template children when the template is deleted', async () => {
    const t = { ...common(a.userId), name: 'Push Day', notes: null, sortOrder: 0 }
    const te = {
      ...common(a.userId),
      templateId: t.id,
      exerciseId: BENCH,
      position: 0,
      supersetGroup: null,
      restSeconds: null,
    }
    const ts = {
      ...common(a.userId),
      templateExerciseId: te.id,
      position: 0,
      setType: 'working',
      targetKind: 'rir',
      targetReps: 8,
      targetRepsMax: 12,
      targetRir: 2,
      plannedWeightKg: 60,
      plannedDurationSec: null,
    }
    await push(a.cookie, [
      { table: 'templates', row: t },
      { table: 'templateExercises', row: te },
      { table: 'templateSets', row: ts },
    ])
    const deletedAt = iso(T0 + 5000)
    await push(a.cookie, [{ table: 'templates', row: { ...t, deletedAt, updatedAt: deletedAt } }])
    const { changes } = await pullAll(a.cookie)
    expect(find(changes, 'templateExercises', te.id)?.deletedAt).toBe(deletedAt)
    expect(find(changes, 'templateSets', ts.id)?.deletedAt).toBe(deletedAt)
  })

  it('clamps updatedAt to at most now + 5 min', async () => {
    const s = sessionRow(a.userId, { updatedAt: iso(Date.now() + 24 * 3600_000) })
    const before = Date.now()
    await push(a.cookie, [{ table: 'sessions', row: s }])
    const stored = Date.parse(
      String(find((await pullAll(a.cookie)).changes, 'sessions', s.id)?.updatedAt),
    )
    expect(stored).toBeGreaterThanOrEqual(before + MAX_CLOCK_SKEW_MS)
    expect(stored).toBeLessThanOrEqual(Date.now() + MAX_CLOCK_SKEW_MS)
    // A device with a correct clock can still win after the skewed device's write.
    const later = { ...s, name: 'Fixed', updatedAt: iso(Date.now() + MAX_CLOCK_SKEW_MS + 1000) }
    expect(await push(a.cookie, [{ table: 'sessions', row: later }])).toMatchObject([
      { status: 'applied' },
    ])
  })

  it('rejects writes to preset exercises', async () => {
    const custom = {
      ...common(a.userId),
      name: 'My Press',
      type: 'weighted',
      muscleGroup: 'chest',
      equipment: 'machine',
      defaultRestSeconds: null,
      isPreset: true,
    }
    const overwrite = { ...custom, id: BENCH, name: 'Hacked', isPreset: false }
    const results = await push(a.cookie, [
      { table: 'exercises', row: custom },
      { table: 'exercises', row: overwrite },
      { table: 'exercises', row: { ...custom, id: uuidv7(), isPreset: false } },
    ])
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'applied'])
    const bench = find((await pullAll(a.cookie)).changes, 'exercises', BENCH)
    expect(bench?.name).toBe('Bench Press')
  })

  it("rejects parents owned by another user and rows of another user's id", async () => {
    const { s, se } = await seedWorkout(a.cookie, a.userId)
    const intoA = sessionExerciseRow(b.userId, s.id)
    const setIntoA = setRow(b.userId, se.id)
    const overwrite = { ...s, name: 'Stolen', updatedAt: iso(T0 + 99_000) }
    const results = await push(b.cookie, [
      { table: 'sessionExercises', row: intoA },
      { table: 'sets', row: setIntoA },
      { table: 'sessions', row: overwrite },
    ])
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(find((await pullAll(a.cookie)).changes, 'sessions', s.id)?.name).toBe('Workout')
  })

  it('rejects children of a parent rejected in the same batch, keeps the rest', async () => {
    const bad = sessionRow(a.userId, { name: '' })
    const orphan = sessionExerciseRow(a.userId, bad.id)
    const orphanSet = setRow(a.userId, orphan.id)
    const missingParent = setRow(a.userId, uuidv7())
    const fine = sessionRow(a.userId)
    const results = await push(a.cookie, [
      { table: 'sets', row: orphanSet },
      { table: 'sessionExercises', row: orphan },
      { table: 'sessions', row: bad },
      { table: 'sets', row: missingParent },
      { table: 'sessions', row: fine },
    ])
    expect(results.map((r) => r.status)).toEqual([
      'rejected',
      'rejected',
      'rejected',
      'rejected',
      'applied',
    ])
    expect(results[2]?.error).toMatch(/^invalid: name/)
    expect(results[3]?.error).toMatch(/unknown parent sessionExercises/)
  })

  it('checks completed sets against the exercise type', async () => {
    const s = sessionRow(a.userId)
    const plank = sessionExerciseRow(a.userId, s.id, { exerciseId: PLANK })
    const repsOnly = setRow(a.userId, plank.id, { reps: 1, completedAt: iso(T0) })
    const timed = setRow(a.userId, plank.id, { durationSec: 90, completedAt: iso(T0), position: 1 })
    const results = await push(a.cookie, [
      { table: 'sessions', row: s },
      { table: 'sessionExercises', row: plank },
      { table: 'sets', row: repsOnly },
      { table: 'sets', row: timed },
    ])
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied', 'rejected', 'applied'])
    // Also when the parent is already on the server.
    const later = setRow(a.userId, plank.id, { reps: 3, completedAt: iso(T0), position: 2 })
    expect(await push(a.cookie, [{ table: 'sets', row: later }])).toMatchObject([
      { status: 'rejected' },
    ])
    const [stored] = await db.select().from(setsTable).where(eq(setsTable.id, repsOnly.id))
    expect(stored).toBeUndefined()
  })

  it('accepts two active sessions (the client asks which to keep)', async () => {
    const one = sessionRow(b.userId)
    const two = sessionRow(b.userId)
    const results = await push(b.cookie, [
      { table: 'sessions', row: one },
      { table: 'sessions', row: two },
    ])
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied'])
  })

  it('pages through changes in serverVersion order without gaps or duplicates', async () => {
    const user = await signUpUser()
    const rows = Array.from({ length: 5 }, () => sessionRow(user.userId))
    await push(
      user.cookie,
      rows.map((row) => ({ table: 'sessions' as const, row })),
    )
    const full = await pullAll(user.cookie)
    const paged = await pullAll(user.cookie, '0', 7)
    expect(paged.changes).toEqual(full.changes)
    expect(paged.cursor).toBe(full.cursor)
    expect(rowsOf(paged.changes, 'sessions').map((r) => r.id)).toEqual(rows.map((r) => r.id))

    // Nothing new after the cursor; a new write shows up alone.
    expect((await pullAll(user.cookie, full.cursor)).changes).toEqual([])
    const edited = { ...rows[0], name: 'Renamed', updatedAt: iso(T0 + 1) }
    await push(user.cookie, [{ table: 'sessions', row: edited }])
    const delta = await pullAll(user.cookie, full.cursor)
    expect(delta.changes).toEqual([{ table: 'sessions', row: { ...edited, userId: user.userId } }])
  })
})
