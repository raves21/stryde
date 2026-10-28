import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { getTrainingRows } from '@/db/repositories/sessions'
import { buildTraining, type Training } from '@/lib/training'

/** History, calendar, stats and PRs from local data (live; works offline). */
export function useTraining(): Training | undefined {
  const rows = useLiveQuery(() => getTrainingRows(), [])
  return useMemo(() => (rows ? buildTraining(rows) : undefined), [rows])
}

/** 3,900,000 ms → "1h 5m"; 45 min → "45m". */
export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`
}
