import { SYNC_TABLES } from '@stryde/shared'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { StrydeDb } from '@/db/db'
import { setCurrentUser } from '@/db/meta'
import { createExercise } from '@/db/repositories/exercises'
import {
  addSessionExercise,
  deleteSession,
  finishSession,
  listActiveSessions,
  startSession,
} from '@/db/repositories/sessions'
import { addSet, updateSet } from '@/db/repositories/sets'
import { freshDb, me } from '@/test/local-db'
import { createSyncEngine, type SyncEngine } from './engine'
import { httpTransport } from './transport'

// Two devices of one user against the real API (DATA_MODEL_AND_SYNC.md §8). Needs
// DATABASE_URL; the global setup starts the API.

const apiUrl = inject('apiUrl')
const ORIGIN = 'http://localhost:5173'

type Device = { db: StrydeDb; engine: SyncEngine }

async function auth(path: string, body: Record<string, string>): Promise<string> {
  const res = await fetch(`${apiUrl}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`)
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

async function device(userId: string, cookie: string): Promise<Device> {
  const db = freshDb()
  await setCurrentUser(me(userId), db)
  const transport = httpTransport({
    baseUrl: apiUrl ?? '',
    headers: () => ({ Cookie: cookie, Origin: ORIGIN }),
  })
  return { db, engine: createSyncEngine({ db, transport }) }
}

async function sync(...devices: Device[]) {
  for (const d of devices) expect(await d.engine.syncNow()).toEqual({ status: 'ok' })
}

/** Every synced row on the device, by table, sorted by id. */
async function snapshot(d: Device) {
  const out: Record<string, unknown[]> = {}
  for (const table of SYNC_TABLES) {
    out[table] = (await d.db.syncTable(table).toArray()).sort((a, b) => a.id.localeCompare(b.id))
  }
  return out
}

/** Separate edits must land on distinct milliseconds for LWW to order them. */
const tick = () => new Promise((r) => setTimeout(r, 5))

describe.skipIf(!apiUrl)('two-device convergence (real API)', () => {
  let one: Device
  let two: Device

  beforeAll(async () => {
    const suffix = Date.now().toString(36)
    const credentials = {
      email: `conv_${suffix}@example.com`,
      username: `conv_${suffix}`,
      password: 'correct-horse-battery',
      name: 'Convergence',
    }
    const cookieOne = await auth('sign-up/email', credentials)
    const cookieTwo = await auth('sign-in/email', {
      email: credentials.email,
      password: credentials.password,
    })
    const meRes = await fetch(`${apiUrl}/api/me`, {
      headers: { Cookie: cookieOne, Origin: ORIGIN },
    })
    const userId = ((await meRes.json()) as { user: { id: string } }).user.id
    one = await device(userId, cookieOne)
    two = await device(userId, cookieTwo)
    await sync(one, two)
  })

  afterAll(async () => {
    await one?.db.delete()
    await two?.db.delete()
  })

  /** A finished workout with one planned set, created on `d` and synced to both. */
  async function sharedSet(d: Device) {
    const exercise = await createExercise(
      { name: 'Bench', type: 'weighted', muscleGroup: 'chest', equipment: 'barbell' },
      d.db,
    )
    const session = await startSession({ name: 'Push' }, d.db)
    const se = await addSessionExercise(
      { sessionId: session.id, exerciseId: exercise.id, position: 0 },
      d.db,
    )
    const set = await addSet(
      {
        sessionExerciseId: se.id,
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
      },
      d.db,
    )
    await finishSession(session.id, d.db)
    await sync(d, d === one ? two : one)
    return { session, se, set }
  }

  it('the initial pull brings presets and the settings row to a new device', async () => {
    const snap = await snapshot(two)
    expect(snap.exercises?.length).toBeGreaterThan(50)
    expect(snap.userSettings).toHaveLength(1)
  })

  it.each([
    ['the earlier editor syncs first', 'earlier-first'],
    ['the later editor syncs first', 'later-first'],
  ])('same set edited offline on both devices converges when %s', async (_, order) => {
    const { set } = await sharedSet(one)
    expect(await two.db.sets.get(set.id)).toBeTruthy()

    // Both offline: device one edits first, device two later.
    const now = () => new Date().toISOString()
    await updateSet(set.id, { reps: 5, weightKg: 70, completedAt: now() }, one.db)
    await tick()
    await updateSet(set.id, { reps: 10, completedAt: now() }, two.db)

    if (order === 'earlier-first') await sync(one, two, one)
    else await sync(two, one, two)

    expect(await one.db.sets.get(set.id)).toMatchObject({ reps: 10, weightKg: 80 })
    expect(await snapshot(one)).toEqual(await snapshot(two))
    expect(await one.db.outbox.count()).toBe(0)
    expect(await two.db.outbox.count()).toBe(0)
  })

  it('a session deleted on one device stays deleted while the other added sets', async () => {
    const { session, se } = await sharedSet(one)
    await deleteSession(session.id, one.db)
    await tick()
    const late = await addSet(
      {
        sessionExerciseId: se.id,
        position: 1,
        setType: 'working',
        targetKind: 'failure',
        targetReps: null,
        targetRepsMax: null,
        targetRir: null,
        weightKg: 80,
        reps: 6,
        rir: 0,
        durationSec: null,
        completedAt: new Date().toISOString(),
      },
      two.db,
    )
    await sync(one, two, one)
    for (const d of [one, two]) {
      expect((await d.db.sessions.get(session.id))?.deletedAt).toBeTruthy()
      expect((await d.db.sets.get(late.id))?.deletedAt).toBeTruthy()
    }
    expect(await snapshot(one)).toEqual(await snapshot(two))
  })

  it('two workouts started offline on both devices both arrive, so the app can ask', async () => {
    const a = await startSession({ name: 'Phone' }, one.db)
    const b = await startSession({ name: 'Laptop' }, two.db)
    await sync(one, two, one)
    for (const d of [one, two]) {
      expect((await listActiveSessions(d.db)).map((s) => s.id).sort()).toEqual([a.id, b.id].sort())
    }
    // Resolving on one device (keep a, discard b) converges everywhere.
    await deleteSession(b.id, one.db)
    await sync(one, two)
    for (const d of [one, two]) {
      expect((await listActiveSessions(d.db)).map((s) => s.id)).toEqual([a.id])
    }
    expect(await snapshot(one)).toEqual(await snapshot(two))
  })
})
