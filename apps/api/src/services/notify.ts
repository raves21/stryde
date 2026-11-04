import {
  FRIEND_MUTABLE_NOTIFICATIONS,
  NOTIFICATION_SETTING_KEYS,
  type NotificationType,
  type PushPayload,
  REACTION_EMOJI_MAP,
  type ReactionEmoji,
} from '@stryde/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  feedEvents,
  friendMutes,
  notifications,
  pushSubscriptions,
  sessions,
  user,
} from '../db/schema'
import { publish } from './events'
import { friendIds } from './friend-graph'
import { pushEnabled, sendPush } from './push'
import { getUserSettings } from './user-settings'

// Notifications (PRODUCT_SPEC.md §4.7): a row for the in-app list, an SSE hint to open
// apps, and a Web Push to every subscribed device, all gated by the recipient's settings.

type NotifyInput = Omit<PushPayload, 'type'> & {
  /** Who caused it; a friend the recipient muted is skipped for friend-originated types. */
  actorId?: string
  /** An unread notification with the same key is updated instead of stacking. */
  dedupe?: string
}

type NotifyOptions = {
  /** Write the in-app row (default). The rest-timer alert is push-only. */
  inApp?: boolean
}

/** Pushes still being delivered; tests await them with `settlePushes`. */
const inflight = new Set<Promise<void>>()
export const settlePushes = async () => {
  await Promise.allSettled([...inflight])
}

const TTL_SECONDS: Record<NotificationType, number> = {
  rest_timer_done: 120,
  friend_workout_finished: 6 * 3600,
  reaction_received: 6 * 3600,
  friend_request: 24 * 3600,
  friend_accepted: 24 * 3600,
}

/**
 * Notify one user. Returns false when their settings (mute all, the type's switch) or a
 * friend mute suppress it. Delivery to devices is not awaited: a push service can be
 * slow and this runs inside request handlers.
 */
export async function notify(
  db: Db,
  userId: string,
  type: NotificationType,
  input: NotifyInput,
  options: NotifyOptions = {},
): Promise<boolean> {
  const settings = await getUserSettings(db, userId)
  if (settings?.notificationsMuted) return false
  if (settings && !settings[NOTIFICATION_SETTING_KEYS[type]]) return false

  if (input.actorId && FRIEND_MUTABLE_NOTIFICATIONS.includes(type)) {
    const [muted] = await db
      .select({ id: friendMutes.userId })
      .from(friendMutes)
      .where(and(eq(friendMutes.userId, userId), eq(friendMutes.mutedUserId, input.actorId)))
      .limit(1)
    if (muted) return false
  }

  const payload: PushPayload = {
    type,
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
  }

  if (options.inApp !== false) {
    const stored = { title: input.title, body: input.body, url: input.url, dedupe: input.dedupe }
    const existing = input.dedupe
      ? await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, type),
              isNull(notifications.readAt),
              sql`${notifications.payload}->>'dedupe' = ${input.dedupe}`,
            ),
          )
          .limit(1)
      : []
    if (existing[0]) {
      await db
        .update(notifications)
        .set({ payload: stored, createdAt: new Date() })
        .where(eq(notifications.id, existing[0].id))
    } else {
      await db.insert(notifications).values({ userId, type, payload: stored })
    }
    publish(userId, { type: 'notification' })
  }

  if (pushEnabled()) {
    const delivery = deliver(db, userId, payload).finally(() => inflight.delete(delivery))
    inflight.add(delivery)
  }
  return true
}

async function deliver(db: Db, userId: string, payload: PushPayload): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
    await Promise.all(
      subs.map(async (sub) => {
        const result = await sendPush(sub, payload, { ttlSeconds: TTL_SECONDS[payload.type] })
        if (result === 'gone') {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        } else if (result === 'sent') {
          await db
            .update(pushSubscriptions)
            .set({ lastUsedAt: new Date() })
            .where(eq(pushSubscriptions.id, sub.id))
        }
      }),
    )
  } catch (error) {
    console.error('push delivery failed', error)
  }
}

/** Run a trigger without letting a notification problem fail the request that caused it. */
async function safely(what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error) {
    console.error(`notification failed: ${what}`, error)
  }
}

const nameOf = async (db: Db, userId: string) => {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  return row?.name ?? 'Someone'
}

const span = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`
}

/** A friend finished a shared workout: tell their friends (caller checked the 60-min rule). */
export async function friendWorkoutFinished(
  db: Db,
  event: { userId: string; sessionId: string; finishedAt: Date },
): Promise<void> {
  await safely('friend_workout_finished', async () => {
    const [row] = await db
      .select({ name: sessions.name, startedAt: sessions.startedAt, prs: feedEvents.prs })
      .from(sessions)
      .leftJoin(feedEvents, eq(feedEvents.sessionId, sessions.id))
      .where(eq(sessions.id, event.sessionId))
      .limit(1)
    if (!row) return
    const prCount = Array.isArray(row.prs) ? row.prs.length : 0
    const parts = [
      `Finished ${row.name}`,
      span(event.finishedAt.getTime() - row.startedAt.getTime()),
      ...(prCount > 0 ? [`${prCount} ${prCount === 1 ? 'PR' : 'PRs'}`] : []),
    ]
    const actor = await nameOf(db, event.userId)
    for (const friendId of await friendIds(db, event.userId)) {
      await notify(db, friendId, 'friend_workout_finished', {
        title: actor,
        body: parts.join(' · '),
        url: `/workout/${event.sessionId}`,
        tag: `workout-${event.sessionId}`,
        actorId: event.userId,
      })
    }
  })
}

/** Someone reacted to a session: tell its owner (not for your own, not on removal). */
export async function reactionReceived(
  db: Db,
  reaction: { actorId: string; sessionId: string; ownerId: string; emoji: ReactionEmoji },
): Promise<void> {
  if (reaction.actorId === reaction.ownerId) return
  await safely('reaction_received', async () => {
    const [session] = await db
      .select({ name: sessions.name })
      .from(sessions)
      .where(eq(sessions.id, reaction.sessionId))
      .limit(1)
    await notify(db, reaction.ownerId, 'reaction_received', {
      title: await nameOf(db, reaction.actorId),
      body: `${REACTION_EMOJI_MAP[reaction.emoji]} reacted to ${session?.name ?? 'your workout'}`,
      url: `/workout/${reaction.sessionId}`,
      tag: `reaction-${reaction.sessionId}`,
      actorId: reaction.actorId,
      dedupe: `reaction:${reaction.sessionId}:${reaction.actorId}`,
    })
  })
}

export async function friendRequestReceived(
  db: Db,
  req: { fromUserId: string; toUserId: string },
): Promise<void> {
  await safely('friend_request', async () => {
    await notify(db, req.toUserId, 'friend_request', {
      title: await nameOf(db, req.fromUserId),
      body: 'Sent you a friend request',
      url: '/friends',
      tag: `friend-request-${req.fromUserId}`,
      dedupe: `request:${req.fromUserId}`,
    })
  })
}

export async function friendAccepted(
  db: Db,
  req: { accepterId: string; requesterId: string },
): Promise<void> {
  await safely('friend_accepted', async () => {
    await notify(db, req.requesterId, 'friend_accepted', {
      title: await nameOf(db, req.accepterId),
      body: 'Accepted your friend request',
      url: '/friends',
      tag: `friend-accepted-${req.accepterId}`,
      dedupe: `accepted:${req.accepterId}`,
    })
  })
}

/** The rest timer ended while the app was in the background: push only, no list entry. */
export async function restTimerDone(db: Db, userId: string, sessionId: string): Promise<void> {
  await safely('rest_timer_done', async () => {
    await notify(
      db,
      userId,
      'rest_timer_done',
      {
        title: 'Rest is over',
        body: 'Time for your next set',
        url: '/workout/active',
        tag: `rest-${sessionId}`,
      },
      { inApp: false },
    )
  })
}
