import type { NotificationItem, NotificationsPage, NotificationType } from '@stryde/shared'
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { notifications } from '../db/schema'

// In-app notification list (UI_DESIGN.md §5.13). Cursor = "<createdAt ISO>|<id>".

function parseCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null
  const [iso, id] = cursor.split('|')
  const at = new Date(iso ?? '')
  return id && !Number.isNaN(at.getTime()) ? { at, id } : null
}

export async function listNotifications(
  db: Db,
  userId: string,
  opts: { before?: string; limit: number },
): Promise<NotificationsPage> {
  const cursor = parseCursor(opts.before)
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        cursor
          ? or(
              lt(notifications.createdAt, cursor.at),
              and(eq(notifications.createdAt, cursor.at), lt(notifications.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit + 1)
  const page = rows.slice(0, opts.limit)

  const [unread] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  const items: NotificationItem[] = page.map((n) => {
    const p = n.payload as { title?: string; body?: string; url?: string }
    return {
      id: n.id,
      type: n.type as NotificationType,
      title: p.title ?? '',
      body: p.body ?? '',
      url: p.url ?? '/',
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }
  })
  const last = page.at(-1)
  return {
    items,
    unreadCount: unread?.n ?? 0,
    nextCursor:
      rows.length > opts.limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  }
}

/** Mark the given notifications (or all) of the user as read. */
export async function markRead(db: Db, userId: string, ids?: string[]): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ids && ids.length > 0 ? inArray(notifications.id, ids) : undefined,
      ),
    )
    .returning({ id: notifications.id })
  return updated.length
}
