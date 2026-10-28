import type { Me } from '@/lib/api'
import { db as defaultDb, type StrydeDb } from './db'

// `meta` is local bookkeeping (not synced), so it's written here rather than
// through a synced-table repository.

const CURRENT_USER = 'currentUser'
const OWNER = 'owner'

/** Whose data the local database holds. Unlike the session cache, it survives a 401. */
export type Owner = { id: string; username: string | null }

export async function getMeta<T>(key: string, db: StrydeDb = defaultDb): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown, db: StrydeDb = defaultDb) {
  await db.meta.put({ key, value })
}

export async function getCurrentUser(db: StrydeDb = defaultDb): Promise<Me | null> {
  return (await getMeta<Me>(CURRENT_USER, db)) ?? null
}

export async function getOwner(db: StrydeDb = defaultDb): Promise<Owner | null> {
  const owner = await getMeta<Owner>(OWNER, db)
  if (owner) return owner
  // Databases from before the owner key: the cached user owned the data.
  const me = await getCurrentUser(db)
  return me ? { id: me.user.id, username: me.user.username } : null
}

/**
 * Cache the signed-in user. Signing in as a different user than the owner of the
 * local data clears the whole local database first, including unsynced changes
 * (DATA_MODEL_AND_SYNC.md §4; the login screen warns about them beforehand).
 */
export async function setCurrentUser(me: Me, db: StrydeDb = defaultDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const owner = await getOwner(db)
    if (owner && owner.id !== me.user.id) {
      await Promise.all(db.tables.map((t) => t.clear()))
    }
    await db.meta.bulkPut([
      { key: CURRENT_USER, value: me },
      { key: OWNER, value: { id: me.user.id, username: me.user.username } satisfies Owner },
    ])
  })
}

/** Forget the cached session (401) without touching any other local data. */
export async function clearCurrentUser(db: StrydeDb = defaultDb): Promise<void> {
  await db.meta.delete(CURRENT_USER)
}

/** Sign-out: wipe everything local. */
export async function clearLocalData(db: StrydeDb = defaultDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
