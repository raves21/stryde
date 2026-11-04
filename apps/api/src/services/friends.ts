import type {
  Friend,
  FriendRequests,
  PublicProfile,
  Relation,
  UserSearchResult,
} from '@stryde/shared'
import { normalizeUsername } from '@stryde/shared'
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { feedEvents, friendMutes, friendships, user } from '../db/schema'
import { areFriends, friendIds, pair } from './friend-graph'
import { friendAccepted, friendRequestReceived } from './notify'

// Friendships (PRODUCT_SPEC.md §3, DATA_MODEL_AND_SYNC.md §7). Mutual: a request is
// accepted by the addressee; either side can remove the friend afterwards.

export type Failure = {
  error: { status: 400 | 404 | 409; code: string; message: string }
}
const fail = (status: 400 | 404 | 409, code: string, message: string): Failure => ({
  error: { status, code, message },
})
export const isFailure = (r: unknown): r is Failure =>
  typeof r === 'object' && r !== null && 'error' in r

type UserRow = typeof user.$inferSelect

export const publicProfile = (u: Pick<UserRow, 'username' | 'name' | 'image'>): PublicProfile => ({
  username: u.username ?? '',
  displayName: u.name,
  avatarUrl: u.image ?? null,
})

/** Escapes LIKE wildcards so a search for `a_b` doesn't match `axb`. */
const likePrefix = (q: string) => `${q.replace(/[\\%_]/g, '\\$&')}%`

/** Prefix username search, max 10, never the caller. Reveals only the public profile. */
export async function searchUsers(db: Db, me: string, q: string): Promise<UserSearchResult[]> {
  const prefix = normalizeUsername(q)
  if (!prefix) return []
  const found = await db
    .select()
    .from(user)
    .where(and(ne(user.id, me), sql`${user.username} LIKE ${likePrefix(prefix)}`))
    .orderBy(user.username)
    .limit(10)
  if (found.length === 0) return []

  const ids = found.map((u) => u.id)
  const rels = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me), inArray(friendships.addresseeId, ids)),
        and(eq(friendships.addresseeId, me), inArray(friendships.requesterId, ids)),
      ),
    )
  const relation = new Map<string, Relation>()
  for (const r of rels) {
    const other = r.requesterId === me ? r.addresseeId : r.requesterId
    if (r.status === 'accepted') relation.set(other, 'friend')
    else if (r.status === 'pending')
      relation.set(other, r.requesterId === me ? 'outgoing' : 'incoming')
  }
  return found.map((u) => ({ ...publicProfile(u), relation: relation.get(u.id) ?? 'none' }))
}

/**
 * Send a request by username. If they already asked me, it is accepted instead. A
 * declined pair can ask again (the new request replaces the old row).
 */
export async function sendRequest(
  db: Db,
  me: string,
  rawUsername: string,
): Promise<{ status: 'pending' | 'accepted' } | Failure> {
  const username = normalizeUsername(rawUsername)
  const [target] = await db.select().from(user).where(eq(user.username, username)).limit(1)
  if (!target) return fail(404, 'user_not_found', 'No user with that username')
  if (target.id === me) return fail(400, 'self_request', "You can't add yourself")

  const [existing] = await db.select().from(friendships).where(pair(me, target.id)).limit(1)
  if (!existing) {
    await db.insert(friendships).values({ requesterId: me, addresseeId: target.id })
    await friendRequestReceived(db, { fromUserId: me, toUserId: target.id })
    return { status: 'pending' }
  }
  if (existing.status === 'accepted') return fail(409, 'already_friends', 'You are already friends')
  if (existing.status === 'pending') {
    if (existing.requesterId === me) return fail(409, 'already_requested', 'Request already sent')
    await db
      .update(friendships)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(friendships.id, existing.id))
    await friendAccepted(db, { accepterId: me, requesterId: target.id })
    return { status: 'accepted' }
  }
  await db
    .update(friendships)
    .set({ requesterId: me, addresseeId: target.id, status: 'pending', updatedAt: new Date() })
    .where(eq(friendships.id, existing.id))
  await friendRequestReceived(db, { fromUserId: me, toUserId: target.id })
  return { status: 'pending' }
}

/** Accept or decline a pending request addressed to me; anything else is a 404. */
export async function answerRequest(
  db: Db,
  me: string,
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<{ status: typeof status } | Failure> {
  const updated = await db
    .update(friendships)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(friendships.id, requestId),
        eq(friendships.addresseeId, me),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ id: friendships.id, requesterId: friendships.requesterId })
  const request = updated[0]
  if (!request) return fail(404, 'not_found', 'Request not found')
  if (status === 'accepted') {
    await friendAccepted(db, { accepterId: me, requesterId: request.requesterId })
  }
  return { status }
}

/**
 * Remove a friend, or cancel my own pending request to them. Both drop the row, and any
 * mutes between the two, so they can start fresh later.
 */
export async function removeFriend(
  db: Db,
  me: string,
  otherId: string,
): Promise<{ removed: true } | Failure> {
  const deleted = await db
    .delete(friendships)
    .where(
      and(
        pair(me, otherId),
        or(
          eq(friendships.status, 'accepted'),
          and(eq(friendships.status, 'pending'), eq(friendships.requesterId, me)),
        ),
      ),
    )
    .returning({ id: friendships.id })
  if (deleted.length === 0) return fail(404, 'not_found', 'Friend not found')
  await db
    .delete(friendMutes)
    .where(
      or(
        and(eq(friendMutes.userId, me), eq(friendMutes.mutedUserId, otherId)),
        and(eq(friendMutes.userId, otherId), eq(friendMutes.mutedUserId, me)),
      ),
    )
  return { removed: true }
}

export async function listFriends(db: Db, me: string): Promise<Friend[]> {
  const ids = await friendIds(db, me)
  if (ids.length === 0) return []
  const users = await db.select().from(user).where(inArray(user.id, ids))
  const mutes = new Set(
    (
      await db
        .select({ id: friendMutes.mutedUserId })
        .from(friendMutes)
        .where(and(eq(friendMutes.userId, me), inArray(friendMutes.mutedUserId, ids)))
    ).map((m) => m.id),
  )
  const last = new Map<string, string>()
  const events = await db
    .select({ userId: feedEvents.userId, at: sql<Date>`max(${feedEvents.createdAt})` })
    .from(feedEvents)
    .where(and(inArray(feedEvents.userId, ids), eq(feedEvents.hidden, false)))
    .groupBy(feedEvents.userId)
  for (const e of events) last.set(e.userId, new Date(e.at).toISOString())
  return users
    .map((u) => ({
      ...publicProfile(u),
      userId: u.id,
      lastWorkoutAt: last.get(u.id) ?? null,
      muted: mutes.has(u.id),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function listRequests(db: Db, me: string): Promise<FriendRequests> {
  const rows = await db
    .select({ f: friendships, u: user })
    .from(friendships)
    .innerJoin(
      user,
      or(
        and(eq(friendships.requesterId, me), eq(user.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, me), eq(user.id, friendships.requesterId)),
      ),
    )
    .where(
      and(
        eq(friendships.status, 'pending'),
        or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
      ),
    )
    .orderBy(desc(friendships.createdAt))
  const out: FriendRequests = { incoming: [], outgoing: [] }
  for (const { f, u } of rows) {
    const item = {
      id: f.id,
      user: { ...publicProfile(u), userId: u.id },
      createdAt: f.createdAt.toISOString(),
    }
    ;(f.requesterId === me ? out.outgoing : out.incoming).push(item)
  }
  return out
}

/** Mute or unmute a friend's workout notifications (no-op unless we're friends). */
export async function setMute(
  db: Db,
  me: string,
  friendId: string,
  muted: boolean,
): Promise<{ muted: boolean } | Failure> {
  if (!(await areFriends(db, me, friendId))) return fail(404, 'not_found', 'Friend not found')
  if (muted) {
    await db.insert(friendMutes).values({ userId: me, mutedUserId: friendId }).onConflictDoNothing()
  } else {
    await db
      .delete(friendMutes)
      .where(and(eq(friendMutes.userId, me), eq(friendMutes.mutedUserId, friendId)))
  }
  return { muted }
}
