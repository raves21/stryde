import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getOwner } from '@/db/meta'

/** The previous user's unsynced changes still on this device, if any. */
export function useUnsyncedOwner(): { username: string | null; pending: number } | null {
  return (
    useLiveQuery(async () => {
      const pending = await db.outbox.count()
      const owner = await getOwner()
      return owner && pending > 0 ? { username: owner.username, pending } : null
    }, []) ?? null
  )
}
