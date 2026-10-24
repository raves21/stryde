import type { Me } from '@/lib/api'
import { db as defaultDb, type StrydeDb } from './db'

// `meta` is local bookkeeping (not synced), so it's written here rather than
// through a synced-table repository.

const CURRENT_USER = 'currentUser'
const PENDING_UNIT = 'onboarding.unit'

export async function getCurrentUser(db: StrydeDb = defaultDb): Promise<Me | null> {
  const row = await db.meta.get(CURRENT_USER)
  return (row?.value as Me | undefined) ?? null
}

/**
 * Cache the signed-in user. Signing in as a different user clears the whole
 * local database first (DATA_MODEL_AND_SYNC.md §4).
 */
export async function setCurrentUser(me: Me, db: StrydeDb = defaultDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const previous = await db.meta.get(CURRENT_USER)
    const previousId = (previous?.value as Me | undefined)?.user.id
    if (previousId && previousId !== me.user.id) {
      await Promise.all(db.tables.map((t) => t.clear()))
    }
    await db.meta.put({ key: CURRENT_USER, value: me })
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

/**
 * Unit picked during onboarding. user_settings is a synced table, so it can only
 * be written through repositories (Phase 2); until then the choice waits here.
 */
export async function setPendingUnit(unit: 'kg' | 'lb', db: StrydeDb = defaultDb): Promise<void> {
  await db.meta.put({ key: PENDING_UNIT, value: unit })
}

export async function getPendingUnit(db: StrydeDb = defaultDb): Promise<'kg' | 'lb' | null> {
  const row = await db.meta.get(PENDING_UNIT)
  return row?.value === 'kg' || row?.value === 'lb' ? row.value : null
}
