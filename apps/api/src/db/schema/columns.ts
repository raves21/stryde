import { bigint, timestamp, uuid } from 'drizzle-orm/pg-core'

const timestamptz = () => timestamp({ withTimezone: true, mode: 'date' })

/**
 * Common columns of every synced table (DATA_MODEL_AND_SYNC.md §2).
 * `id` is a client-generated UUIDv7. `serverVersion` is set by the
 * `set_server_version()` trigger on every insert/update; the default is a placeholder.
 * Foreign keys between synced tables live in the custom SQL migration (DEFERRABLE).
 */
export const syncedColumns = {
  id: uuid().primaryKey(),
  userId: uuid().notNull(),
  createdAt: timestamptz().notNull(),
  updatedAt: timestamptz().notNull(),
  deletedAt: timestamptz(),
  serverVersion: bigint({ mode: 'number' }).notNull().default(0),
}

export { timestamptz }
