import type { PullResponse, PushRequest, PushResponse } from '@stryde/shared'
import { afterEach, describe, expect, it } from 'vitest'
import type { StrydeDb } from '@/db/db'
import { getMeta } from '@/db/meta'
import { createExercise, updateExercise } from '@/db/repositories/exercises'
import { addSessionExercise, startSession, updateSession } from '@/db/repositories/sessions'
import { createTemplate, updateTemplate } from '@/db/repositories/templates'
import { signedInDb } from '@/test/local-db'
import { applyPulled, createSyncEngine, META_CURSOR, META_LAST_SYNC_AT } from './engine'
import { NetworkError, type SyncTransport, UnauthorizedError } from './transport'

const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'

type Script = {
  push?: (req: PushRequest) => Promise<PushResponse> | PushResponse
  pull?: (cursor: string) => Promise<PullResponse> | PullResponse
}

/** A transport that records pushes and answers from the script (defaults: apply all, no changes). */
function scripted(script: Script = {}) {
  const pushes: PushRequest[] = []
  const transport: SyncTransport = {
    async push(req) {
      pushes.push(req)
      if (script.push) return script.push(req)
      return {
        results: req.mutations.map((m) => ({ table: m.table, id: m.row.id, status: 'applied' })),
      }
    },
    async pull(cursor) {
      if (script.pull) return script.pull(cursor)
      return { changes: [], cursor, hasMore: false }
    },
  }
  return { transport, pushes }
}

const exercise = (over: Record<string, unknown> = {}) => ({
  id: '01a16d28-9e70-750e-917d-ccf0c6e2dfd5',
  userId: null,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  deletedAt: null,
  name: 'Bench Press',
  type: 'weighted',
  muscleGroup: 'chest',
  equipment: 'barbell',
  defaultRestSeconds: 180,
  isPreset: true,
  ...over,
})

describe('sync engine', () => {
  let db: StrydeDb
  afterEach(async () => {
    await db.delete()
  })

  it('pushes the outbox, clears applied and stale entries, keeps rejected ones aside', async () => {
    db = await signedInDb(USER)
    const a = await createTemplate({ name: 'A' }, db)
    const b = await createTemplate({ name: 'B' }, db)
    const c = await createTemplate({ name: 'C' }, db)
    const status = { [a.id]: 'applied', [b.id]: 'ignored_stale', [c.id]: 'rejected' } as const
    const { transport, pushes } = scripted({
      push: (req) => ({
        results: req.mutations.map((m) => ({
          table: m.table,
          id: m.row.id,
          status: status[m.row.id] ?? 'applied',
          ...(m.row.id === c.id ? { error: 'invalid: name' } : {}),
        })),
      }),
    })
    expect(await createSyncEngine({ db, transport }).syncNow()).toEqual({ status: 'ok' })
    expect(pushes).toHaveLength(1)
    expect(pushes[0]?.mutations.map((m) => m.row.id)).toEqual([a.id, b.id, c.id])
    expect(await db.outbox.count()).toBe(0)
    expect(await db.syncErrors.toArray()).toEqual([
      expect.objectContaining({ table: 'templates', rowId: c.id, error: 'invalid: name' }),
    ])
    expect(await getMeta(META_LAST_SYNC_AT, db)).toBeTruthy()
  })

  it('pushes parents before children and in batches of at most 200', async () => {
    db = await signedInDb(USER)
    const session = await startSession({ name: 'Workout' }, db)
    await db.exercises.put(exercise() as never)
    // Edit the parent last so its outbox entry is queued after its children.
    for (let i = 0; i < 205; i += 1) {
      await addSessionExercise(
        { sessionId: session.id, exerciseId: exercise().id, position: i },
        db,
      )
    }
    await updateSession(session.id, { name: 'Renamed' }, db)

    const { transport, pushes } = scripted()
    await createSyncEngine({ db, transport }).syncNow()
    expect(pushes.map((p) => p.mutations.length)).toEqual([200, 6])
    expect(pushes[0]?.mutations[0]).toMatchObject({ table: 'sessions', row: { name: 'Renamed' } })
    expect(new Set(pushes.map((p) => p.clientId)).size).toBe(1)
  })

  it('keeps an entry that was edited while its push was in flight', async () => {
    db = await signedInDb(USER)
    const t = await createTemplate({ name: 'Before' }, db)
    let edited = false
    const { transport, pushes } = scripted({
      push: async (req) => {
        if (!edited) {
          edited = true
          await updateTemplate(t.id, { name: 'After' }, db)
        }
        return {
          results: req.mutations.map((m) => ({ table: m.table, id: m.row.id, status: 'applied' })),
        }
      },
    })
    await createSyncEngine({ db, transport }).syncNow()
    // The in-flight snapshot was acknowledged; the newer one was pushed next.
    expect(pushes.map((p) => p.mutations[0]?.row)).toMatchObject([
      { name: 'Before' },
      { name: 'After' },
    ])
    expect(await db.outbox.count()).toBe(0)
  })

  it('pulls until done, applying rows under LWW and storing the cursor', async () => {
    db = await signedInDb(USER)
    const newer = exercise({ updatedAt: '2026-10-25T00:00:00.000Z', name: 'Bench' })
    const older = exercise({ updatedAt: '2026-10-23T00:00:00.000Z', name: 'Old' })
    const pages: Record<string, PullResponse> = {
      '0': { changes: [{ table: 'exercises', row: exercise() }], cursor: '10', hasMore: true },
      '10': { changes: [{ table: 'exercises', row: newer }], cursor: '20', hasMore: true },
      '20': { changes: [{ table: 'exercises', row: older }], cursor: '30', hasMore: false },
    }
    const seen: string[] = []
    const { transport } = scripted({
      pull: (cursor) => {
        seen.push(cursor)
        const page = pages[cursor]
        if (!page) throw new Error(`unexpected cursor ${cursor}`)
        return page
      },
    })
    await createSyncEngine({ db, transport }).syncNow()
    expect(seen).toEqual(['0', '10', '20'])
    expect((await db.exercises.get(exercise().id))?.name).toBe('Bench')
    expect(await getMeta(META_CURSOR, db)).toBe('30')
  })

  it('keeps a pending local change over an older pulled row, yields to a newer one', async () => {
    db = await signedInDb(USER)
    const mine = await createExercise(
      { name: 'Mine', type: 'weighted', muscleGroup: 'back', equipment: 'cable' },
      db,
    )
    const remote = (name: string, offsetMs: number) => ({
      ...mine,
      name,
      updatedAt: new Date(Date.parse(mine.updatedAt) + offsetMs).toISOString(),
    })
    const page = (row: typeof mine, cursor: string) => ({
      changes: [{ table: 'exercises' as const, row }],
      cursor,
      hasMore: false,
    })
    await applyPulled(db, page(remote('Older', -1000), '1'))
    expect((await db.exercises.get(mine.id))?.name).toBe('Mine')
    expect(await db.outbox.count()).toBe(1)

    await applyPulled(db, page(remote('Newer', 1000), '2'))
    expect((await db.exercises.get(mine.id))?.name).toBe('Newer')
    expect(await db.outbox.count()).toBe(0)
  })

  it('drops invalid pulled rows without failing the page', async () => {
    db = await signedInDb(USER)
    await applyPulled(db, {
      changes: [
        { table: 'exercises', row: exercise({ name: '' }) },
        { table: 'exercises', row: exercise({ id: '01a16d28-9e71-700c-8c74-4a445ff58997' }) },
      ],
      cursor: '5',
      hasMore: false,
    })
    expect(await db.exercises.count()).toBe(1)
    expect(await getMeta(META_CURSOR, db)).toBe('5')
  })

  it('reports offline and keeps the outbox on network errors', async () => {
    db = await signedInDb(USER)
    await createTemplate({ name: 'A' }, db)
    const engine = createSyncEngine({
      db,
      transport: {
        push: async () => {
          throw new NetworkError('down')
        },
        pull: async () => {
          throw new NetworkError('down')
        },
      },
    })
    expect(await engine.syncNow()).toEqual({ status: 'offline' })
    expect(await db.outbox.count()).toBe(1)
  })

  it('stops on 401 and keeps the outbox', async () => {
    db = await signedInDb(USER)
    await createTemplate({ name: 'A' }, db)
    const engine = createSyncEngine({
      db,
      transport: {
        push: async () => {
          throw new UnauthorizedError('gone')
        },
        pull: async () => ({ changes: [], cursor: '0', hasMore: false }),
      },
    })
    expect(await engine.syncNow()).toEqual({ status: 'unauthorized' })
    expect(await db.outbox.count()).toBe(1)
  })

  it('is single-flight and reruns once for calls made during a run', async () => {
    db = await signedInDb(USER)
    let pulls = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const engine = createSyncEngine({
      db,
      transport: {
        push: async () => ({ results: [] }),
        pull: async (cursor) => {
          pulls += 1
          if (pulls === 1) await gate
          return { changes: [], cursor, hasMore: false }
        },
      },
    })
    const first = engine.syncNow()
    const second = engine.syncNow()
    const third = engine.syncNow()
    expect(second).toBe(first)
    expect(third).toBe(first)
    release()
    await first
    expect(pulls).toBe(2)
  })

  it('pushes edits of rows it has pulled', async () => {
    db = await signedInDb(USER)
    const custom = exercise({
      id: '01a16d28-9e71-700c-8c74-4de6ba74b40c',
      userId: USER,
      isPreset: false,
      name: 'Custom',
    })
    await applyPulled(db, {
      changes: [{ table: 'exercises', row: custom }],
      cursor: '1',
      hasMore: false,
    })
    await updateExercise(custom.id as string, { name: 'Custom 2' }, db)
    const { transport, pushes } = scripted()
    await createSyncEngine({ db, transport }).syncNow()
    expect(pushes[0]?.mutations).toMatchObject([{ table: 'exercises', row: { name: 'Custom 2' } }])
  })
})
