import type { Db } from '../db/client'

/**
 * Notification enqueueing. Phase 9 fills this in (in-app list + Web Push); until then
 * the feed-event code calls it as a no-op so the call site is already in place.
 */
export async function friendWorkoutFinished(
  _db: Db,
  _event: { userId: string; sessionId: string; finishedAt: Date },
): Promise<void> {}
