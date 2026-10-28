import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getMeta, setMeta } from '@/db/meta'

// The rest timer is a timestamp in local meta (not synced), so it survives reloads and
// app kills (AGENTS.md hard rule 7: timers come from timestamps, never counters).

export type RestTimer = {
  endsAt: string
  /** Full length, for the progress bar. */
  durationSec: number
  sessionId: string
  setId: string
}

const KEY = 'workout.restTimer'

/**
 * Phase 9 hooks the background rest-timer push in here (POST/DELETE /api/rest-timer).
 */
export function onRestTimerChanged(_endsAt: string | null): void {}

export async function startRestTimer(timer: Omit<RestTimer, 'endsAt'>) {
  const endsAt = new Date(Date.now() + timer.durationSec * 1000).toISOString()
  await setMeta(KEY, { ...timer, endsAt } satisfies RestTimer)
  onRestTimerChanged(endsAt)
}

/** ±15 s buttons; never below now. */
export async function adjustRestTimer(deltaSec: number) {
  const timer = await getMeta<RestTimer>(KEY)
  if (!timer) return
  const endsAt = new Date(
    Math.max(Date.now(), Date.parse(timer.endsAt) + deltaSec * 1000),
  ).toISOString()
  await setMeta(KEY, {
    ...timer,
    endsAt,
    durationSec: Math.max(1, timer.durationSec + deltaSec),
  } satisfies RestTimer)
  onRestTimerChanged(endsAt)
}

/** Skip, or stop when its set is un-ticked (pass the set id), or on finish/discard. */
export async function clearRestTimer(onlyForSetId?: string) {
  const timer = await getMeta<RestTimer>(KEY)
  if (!timer || (onlyForSetId && timer.setId !== onlyForSetId)) return
  await db.meta.delete(KEY)
  onRestTimerChanged(null)
}

export function useRestTimer(): RestTimer | null {
  return useLiveQuery(async () => (await getMeta<RestTimer>(KEY)) ?? null, [], null)
}
