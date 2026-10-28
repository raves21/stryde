import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SyncErrorEntry } from '@/db/db'

/** Number of local changes not yet pushed (live). */
export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0)
}

/** Number of mutations the server rejected (live). */
export function useSyncErrorCount(): number {
  return useLiveQuery(() => db.syncErrors.count(), [], 0)
}

/** Rejected mutations, newest first (Settings → Sync & data). */
export function useSyncErrors(): SyncErrorEntry[] {
  return useLiveQuery(async () => (await db.syncErrors.toArray()).reverse(), [], [])
}

/** Forget a rejected mutation (it stays applied locally only). */
export async function dismissSyncError(id: number) {
  await db.syncErrors.delete(id)
}
