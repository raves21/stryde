import Dexie, { type EntityTable } from 'dexie'

export type MetaRow = { key: string; value: unknown }

/**
 * Local database. Phase 1 has only `meta`; Phase 2 adds the synced tables and
 * the outbox in a new Dexie version.
 */
export class StrydeDb extends Dexie {
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'stryde') {
    super(name)
    this.version(1).stores({
      meta: 'key',
    })
  }
}

export const db = new StrydeDb()
