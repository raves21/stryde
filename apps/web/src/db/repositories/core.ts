import { type SyncChange, type SyncRowMap, type SyncTable, syncRowSchemas } from '@stryde/shared'
import { db as defaultDb, type StrydeDb } from '../db'
import { newId } from '../ids'
import { getOwner } from '../meta'

// The only write path for synced tables (AGENTS.md hard rule 1). Every write puts the
// full row and replaces the row's pending outbox entry in the same transaction.

type Common = 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'
export type NewRow<T extends SyncTable> = Omit<SyncRowMap[T], Common> & { id?: string }
export type RowPatch<T extends SyncTable> = Partial<Omit<SyncRowMap[T], Common>>

const listeners = new Set<() => void>()

/** Called after every committed local write (drives the debounced sync). */
export function onLocalWrite(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export class Writer {
  constructor(
    readonly db: StrydeDb,
    readonly userId: string,
    /** One timestamp per transaction, so a cascade shares the parent's time. */
    readonly now: string,
  ) {}

  async insert<T extends SyncTable>(table: T, fields: NewRow<T>): Promise<SyncRowMap[T]> {
    const row = {
      id: newId(),
      ...fields,
      userId: this.userId,
      createdAt: this.now,
      updatedAt: this.now,
      deletedAt: null,
    }
    return this.put(table, row)
  }

  /** Merge a patch into a live row. Throws if the row is missing or deleted. */
  async update<T extends SyncTable>(
    table: T,
    id: string,
    patch: RowPatch<T>,
  ): Promise<SyncRowMap[T]> {
    const existing = await this.get(table, id)
    if (!existing) throw new Error(`${table} ${id} not found`)
    return this.put(table, { ...existing, ...patch, updatedAt: this.now })
  }

  /** Soft-delete the given rows (missing or already deleted ones are skipped). */
  async softDelete(table: SyncTable, ids: string[]): Promise<void> {
    for (const id of ids) {
      const existing = await this.get(table, id)
      if (existing) {
        await this.put(table, { ...existing, deletedAt: this.now, updatedAt: this.now })
      }
    }
  }

  /** A live (not deleted) row. */
  async get<T extends SyncTable>(table: T, id: string): Promise<SyncRowMap[T] | undefined> {
    const row = (await this.db.syncTable(table).get(id)) as SyncRowMap[T] | undefined
    return row && !row.deletedAt ? row : undefined
  }

  private async put<T extends SyncTable>(table: T, row: unknown): Promise<SyncRowMap[T]> {
    // Validate on the way in, so the server never rejects what we queue.
    const parsed = syncRowSchemas[table].parse(row) as SyncRowMap[T]
    await this.db.syncTable(table).put(parsed)
    const outbox = this.db.outbox
    await outbox.where('[table+rowId]').equals([table, parsed.id]).delete()
    const change = { table, row: parsed } as SyncChange
    await outbox.add({ ...change, rowId: parsed.id, queuedAt: this.now } as Parameters<
      typeof outbox.add
    >[0])
    return parsed
  }
}

/**
 * Run `fn` in one read-write transaction over the given tables + outbox + meta.
 * Listeners are notified after commit.
 */
export async function mutate<R>(
  tables: SyncTable[],
  fn: (w: Writer) => Promise<R>,
  db: StrydeDb = defaultDb,
): Promise<R> {
  const stores = [...tables.map((t) => db.syncTable(t)), db.outbox, db.meta]
  const result = await db.transaction('rw', stores, async () => {
    const owner = await getOwner(db)
    if (!owner) throw new Error('No signed-in user')
    return fn(new Writer(db, owner.id, new Date().toISOString()))
  })
  for (const listener of listeners) listener()
  return result
}
