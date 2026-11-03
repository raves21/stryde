import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { sessions } from '../db/schema'
import { areFriends } from './friends'

export type SessionRecord = typeof sessions.$inferSelect

/**
 * The session if `viewerId` may see it, else null (routes answer 404, never 403, so
 * ids can't be probed): the owner, or an accepted friend when the session is shared,
 * finished and not deleted (PRODUCT_SPEC.md §3). An unfinished or deleted session is
 * invisible even to its owner here; the owner reads those from their own device.
 */
export async function canViewSession(
  db: Db,
  viewerId: string,
  sessionId: string,
): Promise<SessionRecord | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)))
    .limit(1)
  if (!session || session.finishedAt === null) return null
  if (session.userId === viewerId) return session
  if (!session.shareWithFriends) return null
  return (await areFriends(db, viewerId, session.userId)) ? session : null
}
