import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

/** Dev only: live row counts, to watch rows arrive from another device. */
export function useLocalCounts() {
  return useLiveQuery(
    async () => ({
      exercises: await db.exercises.filter((e) => !e.isPreset && !e.deletedAt).count(),
      sessions: await db.sessions.filter((s) => !s.deletedAt).count(),
      sets: await db.sets.filter((s) => !s.deletedAt).count(),
    }),
    [],
  )
}
