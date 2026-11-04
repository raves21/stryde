import { z } from 'zod'
import type { NotificationType } from '../constants'

// Notification and push payloads (DATA_MODEL_AND_SYNC.md §7, plan/phase-09).

/** `PushSubscription.toJSON()` as the browser produces it. */
export const pushSubscribeSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(500).optional(),
})

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(2048) })

/** Schedule (or replace) the background push for the running rest timer. */
export const restTimerSchema = z.object({
  sessionId: z.uuid(),
  fireAt: z.iso.datetime(),
})

/** Empty `ids` / missing = every unread notification. */
export const markReadSchema = z.object({ ids: z.array(z.uuid()).max(100).optional() })

export const notificationsQuerySchema = z.object({
  before: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

/** What the service worker receives (and what is stored, minus `title`/`body` text). */
export type PushPayload = {
  type: NotificationType
  title: string
  body: string
  /** In-app path to open on tap. */
  url: string
  /** Same tag replaces an earlier notification instead of stacking. */
  tag: string
}

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  body: string
  url: string
  readAt: string | null
  createdAt: string
}

export type NotificationsPage = {
  items: NotificationItem[]
  unreadCount: number
  nextCursor: string | null
}

export type AppConfig = {
  /** VAPID public key; null when push isn't configured on this server. */
  vapidPublicKey: string | null
}

/** Server-sent events over `GET /api/events`. */
export type ServerEvent =
  | { type: 'sync'; origin: string | null }
  | { type: 'feed' }
  | { type: 'notification' }
