import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { getMeta, setMeta } from '@/db/meta'

// The game timer lives in local meta (not synced), like the rest timer: it is a timestamp plus
// the time banked before the last pause, never a counter (AGENTS.md hard rule 7), so it
// survives reloads and app kills. One timer per device, for the sport session in progress.

export type SportTimer = {
  sessionId: string
  /** The game this time belongs to (the session's open set). */
  setId: string
  /** When the clock was last started or resumed; null while paused or not started. */
  runningSince: string | null
  /** Played time banked before `runningSince`. */
  bankedMs: number
}

const KEY = 'workout.sportTimer'

/** Time on the clock at `now` (ms). */
export function timerElapsedMs(timer: SportTimer | null, now: number): number {
  if (!timer) return 0
  const running = timer.runningSince ? Math.max(0, now - Date.parse(timer.runningSince)) : 0
  return timer.bankedMs + running
}

/** Start a game's clock from 0:00. */
export async function startGameClock(sessionId: string, setId: string) {
  await setMeta(KEY, {
    sessionId,
    setId,
    runningSince: new Date().toISOString(),
    bankedMs: 0,
  } satisfies SportTimer)
}

/** A game waiting at 0:00 (after the previous one was finished). */
export async function readyGameClock(sessionId: string, setId: string) {
  await setMeta(KEY, { sessionId, setId, runningSince: null, bankedMs: 0 } satisfies SportTimer)
}

export async function pauseGameClock() {
  const timer = await getMeta<SportTimer>(KEY)
  if (!timer?.runningSince) return
  await setMeta(KEY, {
    ...timer,
    runningSince: null,
    bankedMs: timerElapsedMs(timer, Date.now()),
  } satisfies SportTimer)
}

export async function resumeGameClock() {
  const timer = await getMeta<SportTimer>(KEY)
  if (!timer || timer.runningSince) return
  await setMeta(KEY, { ...timer, runningSince: new Date().toISOString() } satisfies SportTimer)
}

/** Back to 0:00, paused. */
export async function resetGameClock() {
  const timer = await getMeta<SportTimer>(KEY)
  if (!timer) return
  await setMeta(KEY, { ...timer, runningSince: null, bankedMs: 0 } satisfies SportTimer)
}

export async function clearGameClock() {
  await db.meta.delete(KEY)
}

/** The clock of this session's open game, or null if there is none yet (or it is stale). */
export function useGameClock(sessionId: string, setId: string | undefined): SportTimer | null {
  return useLiveQuery(
    async () => {
      const timer = await getMeta<SportTimer>(KEY)
      return timer && timer.sessionId === sessionId && timer.setId === setId ? timer : null
    },
    [sessionId, setId],
    null,
  )
}
