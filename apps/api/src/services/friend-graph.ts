import { and, eq, or } from 'drizzle-orm'
import type { Db } from '../db/client'
import { friendships } from '../db/schema'

// Who is friends with whom. Kept apart from `friends.ts` so notifications can use it
// without importing the code that triggers them.

export const pair = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  )

/** Ids of the user's accepted friends. */
export async function friendIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))
}

export async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(pair(a, b), eq(friendships.status, 'accepted')))
    .limit(1)
  return !!row
}
