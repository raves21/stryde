import { and, eq, isNull, lte } from 'drizzle-orm'
import type { Db } from '../db/client'
import { scheduledPushes, sessions } from '../db/schema'
import { restTimerDone } from './notify'

// Background rest-timer push (plan/phase-09 §5). The client schedules the push when a
// timer starts or changes; an in-process loop sends the due ones. Single instance only.

/** A due push more than this late is dropped: the timer ended long ago. */
export const MAX_LATE_MS = 30_000
const MAX_AHEAD_MS = 60 * 60 * 1000
const TICK_MS = 5_000

type Failure = { error: { status: 400 | 404; code: string; message: string } }

/** Replace the user's pending rest push with one at `fireAt`. */
export async function scheduleRestPush(
  db: Db,
  userId: string,
  sessionId: string,
  fireAt: Date,
  now = new Date(),
): Promise<{ fireAt: string } | Failure> {
  if (fireAt.getTime() > now.getTime() + MAX_AHEAD_MS) {
    return { error: { status: 400, code: 'invalid_request', message: 'fireAt is too far ahead' } }
  }
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.finishedAt),
        isNull(sessions.deletedAt),
      ),
    )
    .limit(1)
  if (!session) return { error: { status: 404, code: 'not_found', message: 'No active workout' } }

  await cancelRestPush(db, userId, now)
  await db.insert(scheduledPushes).values({ userId, sessionId, fireAt })
  return { fireAt: fireAt.toISOString() }
}

const pending = (userId?: string) =>
  and(
    isNull(scheduledPushes.sentAt),
    isNull(scheduledPushes.cancelledAt),
    userId ? eq(scheduledPushes.userId, userId) : undefined,
  )

/** Cancel the user's pending rest push(es). */
export async function cancelRestPush(db: Db, userId: string, now = new Date()): Promise<void> {
  await db.update(scheduledPushes).set({ cancelledAt: now }).where(pending(userId))
}

/**
 * Send what is due. Pushes that are too late are marked cancelled (skipped); the rest are
 * claimed in one UPDATE so a second loop or restart can't send them twice, and only go
 * out if the workout is still in progress.
 */
export async function runDueRestPushes(db: Db, now = new Date()): Promise<number> {
  await db
    .update(scheduledPushes)
    .set({ cancelledAt: now })
    .where(and(pending(), lte(scheduledPushes.fireAt, new Date(now.getTime() - MAX_LATE_MS))))

  const claimed = await db
    .update(scheduledPushes)
    .set({ sentAt: now })
    .where(and(pending(), lte(scheduledPushes.fireAt, now)))
    .returning()

  let sent = 0
  for (const push of claimed) {
    const [active] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, push.sessionId),
          isNull(sessions.finishedAt),
          isNull(sessions.deletedAt),
        ),
      )
      .limit(1)
    if (!active) continue
    await restTimerDone(db, push.userId, push.sessionId)
    sent += 1
  }
  return sent
}

/** Start the loop; it also runs once right away to handle what came due while down. */
export function startRestPushScheduler(db: Db, intervalMs = TICK_MS): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await runDueRestPushes(db)
    } catch (error) {
      console.error('rest push scheduler failed', error)
    } finally {
      running = false
    }
  }
  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  return () => clearInterval(timer)
}
