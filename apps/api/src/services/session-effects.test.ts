import type { PushResponse } from '@stryde/shared'
import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, db } from '../db/client'
import { personalRecords } from '../db/schema'
import { PRESET_EXERCISES } from '../db/seed/exercises'
import { hasDatabase, postJson, signUpUser } from '../test/helpers'

// Server PR recompute after push (plan/phase-05 §2, DATA_MODEL_AND_SYNC.md §6.4).

const BENCH = PRESET_EXERCISES.find((e) => e.name === 'Bench Press')?.id ?? ''
const iso = (ms: number) => new Date(ms).toISOString()
const DAY = 86_400_000
const T0 = Date.now() - 30 * DAY

/** A finished session `daysIn` days after T0 with one completed bench set. */
function workout(userId: string, daysIn: number, weightKg: number, reps: number) {
  const at = T0 + daysIn * DAY
  const common = { userId, createdAt: iso(at), updatedAt: iso(at), deletedAt: null }
  const session = {
    ...common,
    id: uuidv7(),
    templateId: null,
    name: 'Push',
    startedAt: iso(at),
    finishedAt: iso(at + 3600_000),
    timezone: 'UTC',
    localDate: iso(at).slice(0, 10),
    notes: null,
    shareWithFriends: true,
  }
  const se = {
    ...common,
    id: uuidv7(),
    sessionId: session.id,
    exerciseId: BENCH,
    position: 0,
    supersetGroup: null,
    restSeconds: null,
  }
  const set = {
    ...common,
    id: uuidv7(),
    sessionExerciseId: se.id,
    position: 0,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: reps,
    targetRepsMax: null,
    targetRir: null,
    weightKg,
    reps,
    rir: null,
    durationSec: null,
    completedAt: iso(at + 600_000),
  }
  return { session, se, set }
}

describe.skipIf(!hasDatabase)('personal records', () => {
  let user: { cookie: string; userId: string }
  beforeAll(async () => {
    user = await signUpUser()
  })
  afterAll(() => client.end())

  async function push(rows: { table: string; row: Record<string, unknown> }[]) {
    const res = await postJson(
      '/api/sync/push',
      { clientId: uuidv7(), mutations: rows },
      user.cookie,
    )
    const { results } = (await res.json()) as PushResponse
    expect(results.every((r) => r.status === 'applied')).toBe(true)
  }
  const send = (w: ReturnType<typeof workout>) =>
    push([
      { table: 'sessions', row: w.session },
      { table: 'sessionExercises', row: w.se },
      { table: 'sets', row: w.set },
    ])
  const records = async () =>
    Object.fromEntries(
      (
        await db
          .select()
          .from(personalRecords)
          .where(
            and(eq(personalRecords.userId, user.userId), eq(personalRecords.exerciseId, BENCH)),
          )
      ).map((r) => [r.prType, { value: r.value, sessionId: r.sessionId }]),
    )

  it('the first session is a baseline: no records', async () => {
    await send(workout(user.userId, 0, 100, 5))
    expect(await records()).toEqual({})
  })

  it('a heavier session sets records', async () => {
    const heavy = workout(user.userId, 2, 110, 5)
    await send(heavy)
    expect(await records()).toEqual({
      e1rm: { value: 128.33, sessionId: heavy.session.id },
      weight: { value: 110, sessionId: heavy.session.id },
      volume: { value: 550, sessionId: heavy.session.id },
    })

    // Editing that old session down lowers the records again.
    const edited = { ...heavy.set, weightKg: 95, updatedAt: iso(Date.now()) }
    await push([{ table: 'sets', row: edited }])
    expect(await records()).toEqual({})
  })

  it('deleting the session that held a record recomputes from the rest', async () => {
    const a = workout(user.userId, 4, 105, 5)
    const b = workout(user.userId, 6, 107.5, 5)
    await send(a)
    await send(b)
    expect((await records()).weight).toEqual({ value: 107.5, sessionId: b.session.id })
    await push([
      {
        table: 'sessions',
        row: { ...b.session, deletedAt: iso(Date.now()), updatedAt: iso(Date.now()) },
      },
    ])
    expect((await records()).weight).toEqual({ value: 105, sessionId: a.session.id })
  })
})
