import {
  PULL_LIMIT_MAX,
  PUSH_BATCH_SIZE,
  type PullResponse,
  SYNC_TABLES,
  type SyncChange,
  syncRowSchemas,
} from '@stryde/shared'
import type { OutboxEntry, StrydeDb } from '@/db/db'
import { newId } from '@/db/ids'
import { getMeta, setMeta } from '@/db/meta'
import { NetworkError, ServerError, type SyncTransport, UnauthorizedError } from './transport'

// Client sync engine (DATA_MODEL_AND_SYNC.md §5): push the outbox, then pull until
// done. Pure apart from the injected db/transport/lock, so tests can run two of them.

export const META_CURSOR = 'sync.cursor'
export const META_LAST_SYNC_AT = 'sync.lastSyncAt'
const META_CLIENT_ID = 'sync.clientId'

export type SyncResult =
  | { status: 'ok' }
  | { status: 'offline' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

type Lock = <T>(fn: () => Promise<T>) => Promise<T>

export type SyncEngine = { syncNow(): Promise<SyncResult> }

export function createSyncEngine({
  db,
  transport,
  lock = (fn) => fn(),
}: {
  db: StrydeDb
  transport: SyncTransport
  /** Cross-tab mutual exclusion (Web Locks in the app). */
  lock?: Lock
}): SyncEngine {
  let running: Promise<SyncResult> | null = null
  let again = false

  async function runOnce(): Promise<SyncResult> {
    try {
      await lock(async () => {
        await pushAll(db, transport)
        await pullAll(db, transport)
        await setMeta(META_LAST_SYNC_AT, new Date().toISOString(), db)
      })
      return { status: 'ok' }
    } catch (error) {
      if (error instanceof UnauthorizedError) return { status: 'unauthorized' }
      if (error instanceof NetworkError) return { status: 'offline' }
      if (error instanceof ServerError) return { status: 'error', message: error.message }
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    // Single-flight: a call during a run returns that run, which repeats once at the
    // end so changes made meanwhile aren't left waiting for the next trigger.
    syncNow() {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        let result: SyncResult
        do {
          again = false
          result = await runOnce()
        } while (again && result.status === 'ok')
        return result
      })().finally(() => {
        running = null
      })
      return running
    },
  }
}

async function clientId(db: StrydeDb): Promise<string> {
  const existing = await getMeta<string>(META_CLIENT_ID, db)
  if (existing) return existing
  const id = newId()
  await setMeta(META_CLIENT_ID, id, db)
  return id
}

const TABLE_ORDER = new Map(SYNC_TABLES.map((t, i) => [t, i]))

/**
 * Parents before children (then queue order), so a batch boundary never leaves a
 * child in an earlier batch than a new parent it references.
 */
function pushOrder(a: OutboxEntry, b: OutboxEntry): number {
  return (TABLE_ORDER.get(a.table) ?? 0) - (TABLE_ORDER.get(b.table) ?? 0) || a.seq - b.seq
}

async function pushAll(db: StrydeDb, transport: SyncTransport) {
  const id = await clientId(db)
  for (;;) {
    const entries = (await db.outbox.toArray()).sort(pushOrder)
    if (entries.length === 0) return
    const batch = entries.slice(0, PUSH_BATCH_SIZE)
    const { results } = await transport.push({
      clientId: id,
      mutations: batch.map(({ table, row }) => ({ table, row }) as SyncChange),
    })
    if (results.length !== batch.length) throw new ServerError('Push results do not match')

    await db.transaction('rw', db.outbox, db.syncErrors, async () => {
      for (const [i, entry] of batch.entries()) {
        const result = results[i]
        if (!result || result.id !== entry.rowId) throw new ServerError('Push results do not match')
        if (result.status === 'rejected') {
          console.error('sync: mutation rejected', entry.table, entry.rowId, result.error)
          const { seq: _seq, queuedAt: _queuedAt, ...change } = entry
          await db.syncErrors.add({
            ...change,
            error: result.error ?? 'rejected',
            at: new Date().toISOString(),
          } as Parameters<typeof db.syncErrors.add>[0])
        }
        // By seq: if the row was edited during the request, its newer entry stays queued.
        await db.outbox.delete(entry.seq)
      }
    })
  }
}

async function pullAll(db: StrydeDb, transport: SyncTransport) {
  let cursor = (await getMeta<string>(META_CURSOR, db)) ?? '0'
  for (;;) {
    const page = await transport.pull(cursor, PULL_LIMIT_MAX)
    await applyPulled(db, page)
    cursor = page.cursor
    if (!page.hasMore) return
  }
}

/**
 * Apply a page under LWW and store its cursor, atomically. A row with a pending
 * outbox entry keeps the local version unless the incoming row is strictly newer:
 * then the push would be `ignored_stale` anyway, and since the cursor moves past
 * this row now, skipping it would leave this device on the losing version.
 */
export async function applyPulled(db: StrydeDb, page: PullResponse) {
  const stores = [...SYNC_TABLES.map((t) => db.syncTable(t)), db.outbox, db.meta]
  await db.transaction('rw', stores, async () => {
    for (const change of page.changes) {
      const parsed = syncRowSchemas[change.table].safeParse(change.row)
      if (!parsed.success) {
        console.error('sync: dropping invalid pulled row', change.table, change.row.id)
        continue
      }
      const row = parsed.data
      const incomingAt = Date.parse(row.updatedAt)
      const pending = await db.outbox.where('[table+rowId]').equals([change.table, row.id]).first()
      if (pending) {
        if (Date.parse(pending.row.updatedAt) >= incomingAt) continue
        await db.outbox.delete(pending.seq)
      }
      const store = db.syncTable(change.table)
      const local = await store.get(row.id)
      if (local && Date.parse(local.updatedAt) > incomingAt) continue
      await store.put(row)
    }
    await setMeta(META_CURSOR, page.cursor, db)
  })
}
