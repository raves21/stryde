import type { ReactionCounts, ReactionEmoji, Reactor } from '@stryde/shared'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { reactions, user } from '../db/schema'
import { canViewSession } from './access'
import { publish } from './events'
import { publicProfile } from './friends'
import { reactionReceived } from './notify'

/** Reaction counts per emoji and my own reaction, for several sessions in two queries. */
export async function reactionSummary(
  db: Db,
  me: string,
  sessionIds: string[],
): Promise<Map<string, { counts: ReactionCounts; mine: ReactionEmoji | null }>> {
  const out = new Map<string, { counts: ReactionCounts; mine: ReactionEmoji | null }>()
  for (const id of sessionIds) out.set(id, { counts: {}, mine: null })
  if (sessionIds.length === 0) return out

  const counts = await db
    .select({
      sessionId: reactions.sessionId,
      emoji: reactions.emoji,
      n: sql<number>`count(*)::int`,
    })
    .from(reactions)
    .where(inArray(reactions.sessionId, sessionIds))
    .groupBy(reactions.sessionId, reactions.emoji)
  for (const c of counts) {
    const entry = out.get(c.sessionId)
    if (entry) entry.counts[c.emoji] = c.n
  }
  const mine = await db
    .select({ sessionId: reactions.sessionId, emoji: reactions.emoji })
    .from(reactions)
    .where(and(eq(reactions.userId, me), inArray(reactions.sessionId, sessionIds)))
  for (const m of mine) {
    const entry = out.get(m.sessionId)
    if (entry) entry.mine = m.emoji
  }
  return out
}

/** Set or replace my reaction. Null when I can't see the session (route answers 404). */
export async function setReaction(
  db: Db,
  me: string,
  sessionId: string,
  emoji: ReactionEmoji,
): Promise<{ emoji: ReactionEmoji } | null> {
  const session = await canViewSession(db, me, sessionId)
  if (!session) return null
  await db
    .insert(reactions)
    .values({ userId: me, sessionId, emoji })
    .onConflictDoUpdate({
      target: [reactions.userId, reactions.sessionId],
      set: { emoji, createdAt: new Date() },
    })
  await reactionReceived(db, { actorId: me, sessionId, ownerId: session.userId, emoji })
  // The owner's open feed shows reaction counts.
  publish(session.userId, { type: 'feed' })
  return { emoji }
}

/** Remove my reaction (idempotent). Null when I can't see the session. */
export async function removeReaction(
  db: Db,
  me: string,
  sessionId: string,
): Promise<{ removed: true } | null> {
  const session = await canViewSession(db, me, sessionId)
  if (!session) return null
  await db
    .delete(reactions)
    .where(and(eq(reactions.userId, me), eq(reactions.sessionId, sessionId)))
  publish(session.userId, { type: 'feed' })
  return { removed: true }
}

/** Who reacted, newest first. Null when I can't see the session. */
export async function listReactors(
  db: Db,
  me: string,
  sessionId: string,
): Promise<Reactor[] | null> {
  if (!(await canViewSession(db, me, sessionId))) return null
  const rows = await db
    .select({ r: reactions, u: user })
    .from(reactions)
    .innerJoin(user, eq(user.id, reactions.userId))
    .where(eq(reactions.sessionId, sessionId))
    .orderBy(desc(reactions.createdAt))
  return rows.map(({ r, u }) => ({
    ...publicProfile(u),
    userId: u.id,
    emoji: r.emoji,
    createdAt: r.createdAt.toISOString(),
  }))
}
