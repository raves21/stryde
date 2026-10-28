import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

/** Number of local changes not yet pushed (live). */
export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0)
}

/** Number of mutations the server rejected (live). */
export function useSyncErrorCount(): number {
  return useLiveQuery(() => db.syncErrors.count(), [], 0)
}
