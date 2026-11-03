import type { PushResponse } from '@stryde/shared'
import { v7 as uuidv7 } from 'uuid'
import { expect } from 'vitest'
import { PRESET_EXERCISES } from '../db/seed/exercises'
import { get, postJson } from './helpers'

export const BENCH = PRESET_EXERCISES.find((e) => e.name === 'Bench Press')?.id ?? ''
export const SQUAT = PRESET_EXERCISES.find((e) => e.name === 'Back Squat')?.id ?? ''
export const iso = (ms: number) => new Date(ms).toISOString()
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

type Options = {
  name?: string
  /** How long ago the workout finished. */
  finishedAgoMs?: number
  durationMs?: number
  weightKg?: number
  reps?: number
  exerciseId?: string
  shareWithFriends?: boolean
}

/** One finished session with one exercise and one completed working set, as push rows. */
export function workout(userId: string, o: Options = {}) {
  const finishedAt = Date.now() - (o.finishedAgoMs ?? 0)
  const startedAt = finishedAt - (o.durationMs ?? HOUR)
  const reps = o.reps ?? 5
  const common = { userId, createdAt: iso(startedAt), updatedAt: iso(startedAt), deletedAt: null }
  const session = {
    ...common,
    id: uuidv7(),
    templateId: null,
    name: o.name ?? 'Push',
    startedAt: iso(startedAt),
    finishedAt: iso(finishedAt),
    timezone: 'UTC',
    localDate: iso(startedAt).slice(0, 10),
    notes: null,
    shareWithFriends: o.shareWithFriends ?? true,
  }
  const se = {
    ...common,
    id: uuidv7(),
    sessionId: session.id,
    exerciseId: o.exerciseId ?? BENCH,
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
    weightKg: o.weightKg ?? 100,
    reps,
    rir: null,
    durationSec: null,
    completedAt: iso(startedAt + 600_000),
  }
  return { session, se, set, rows: rowsOf({ session, se, set }) }
}

export type PushRow = { table: string; row: Record<string, unknown> }

const rowsOf = (w: { session: object; se: object; set: object }): PushRow[] => [
  { table: 'sessions', row: w.session as Record<string, unknown> },
  { table: 'sessionExercises', row: w.se as Record<string, unknown> },
  { table: 'sets', row: w.set as Record<string, unknown> },
]

/** Push rows as `cookie`'s user and expect every mutation applied. */
export async function pushRows(cookie: string, rows: PushRow[]) {
  const res = await postJson('/api/sync/push', { clientId: uuidv7(), mutations: rows }, cookie)
  const { results } = (await res.json()) as PushResponse
  expect(results.every((r) => r.status === 'applied')).toBe(true)
}

/** Push a session row change (share toggle, delete) with a fresh `updatedAt`. */
export const updateSession = (
  cookie: string,
  w: ReturnType<typeof workout>,
  patch: Record<string, unknown>,
) =>
  pushRows(cookie, [
    { table: 'sessions', row: { ...w.session, ...patch, updatedAt: iso(Date.now()) } },
  ])

export async function usernameOf(cookie: string): Promise<string> {
  const me = (await (await get('/api/me', cookie)).json()) as { user: { username: string } }
  return me.user.username
}

/** Make two signed-in users friends through the API. */
export async function befriend(a: { cookie: string }, b: { cookie: string }) {
  const sent = await postJson(
    '/api/friends/requests',
    { username: await usernameOf(b.cookie) },
    a.cookie,
  )
  expect(sent.status).toBe(200)
  const requests = (await (await get('/api/friends/requests', b.cookie)).json()) as {
    incoming: { id: string }[]
  }
  const id = requests.incoming[0]?.id
  const accepted = await postJson(`/api/friends/requests/${id}/accept`, {}, b.cookie)
  expect(accepted.status).toBe(200)
}
