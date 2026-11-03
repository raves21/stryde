import type { FeedItem, FeedPage, FeedPR } from '@stryde/shared'
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { feedEvents, sessionExercises, sessions, sets, user } from '../db/schema'
import { friendIds, publicProfile } from './friends'
import { reactionSummary } from './reactions'

// Cursor = "<createdAt ISO>|<event id>": events can share a timestamp, the id breaks ties.
function parseCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null
  const [iso, id] = cursor.split('|')
  const at = new Date(iso ?? '')
  return id && !Number.isNaN(at.getTime()) ? { at, id } : null
}

/**
 * Feed (PRODUCT_SPEC.md §4.6): finished, shared sessions of me and my accepted friends,
 * newest finish first. A handful of queries per page, none per item.
 */
export async function getFeed(
  db: Db,
  me: string,
  opts: { before?: string; limit: number },
): Promise<FeedPage> {
  const actors = [me, ...(await friendIds(db, me))]
  const cursor = parseCursor(opts.before)

  const rows = await db
    .select({ event: feedEvents, session: sessions, actor: user })
    .from(feedEvents)
    .innerJoin(sessions, eq(sessions.id, feedEvents.sessionId))
    .innerJoin(user, eq(user.id, feedEvents.userId))
    .where(
      and(
        inArray(feedEvents.userId, actors),
        eq(feedEvents.hidden, false),
        // Belt and braces next to `hidden`: never show an unshared or deleted session.
        eq(sessions.shareWithFriends, true),
        isNull(sessions.deletedAt),
        isNotNull(sessions.finishedAt),
        cursor
          ? or(
              lt(feedEvents.createdAt, cursor.at),
              and(eq(feedEvents.createdAt, cursor.at), lt(feedEvents.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(feedEvents.createdAt), desc(feedEvents.id))
    .limit(opts.limit + 1)

  const page = rows.slice(0, opts.limit)
  const sessionIds = page.map((r) => r.session.id)

  const counts = new Map<string, { exercises: number; sets: number }>()
  if (sessionIds.length > 0) {
    const grouped = await db
      .select({
        sessionId: sessionExercises.sessionId,
        exercises: sql<number>`count(distinct ${sessionExercises.id})::int`,
        sets: sql<number>`count(${sets.id})::int`,
      })
      .from(sets)
      .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
      .where(
        and(
          inArray(sessionExercises.sessionId, sessionIds),
          isNull(sessionExercises.deletedAt),
          isNull(sets.deletedAt),
          eq(sets.setType, 'working'),
          isNotNull(sets.completedAt),
        ),
      )
      .groupBy(sessionExercises.sessionId)
    for (const g of grouped) counts.set(g.sessionId, { exercises: g.exercises, sets: g.sets })
  }
  const reacted = await reactionSummary(db, me, sessionIds)

  const items: FeedItem[] = page.map(({ event, session, actor }) => {
    const finishedAt = session.finishedAt ?? event.createdAt
    const c = counts.get(session.id)
    const r = reacted.get(session.id)
    return {
      id: event.id,
      sessionId: session.id,
      actor: { ...publicProfile(actor), userId: actor.id, isMe: actor.id === me },
      name: session.name,
      startedAt: session.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSec: Math.max(
        0,
        Math.round((finishedAt.getTime() - session.startedAt.getTime()) / 1000),
      ),
      exerciseCount: c?.exercises ?? 0,
      setCount: c?.sets ?? 0,
      prs: event.prs as FeedPR[],
      reactions: r?.counts ?? {},
      myReaction: r?.mine ?? null,
    }
  })

  const last = page.at(-1)
  const hasMore = rows.length > opts.limit && last !== undefined
  return {
    items,
    nextCursor: hasMore ? `${last.event.createdAt.toISOString()}|${last.event.id}` : null,
  }
}
