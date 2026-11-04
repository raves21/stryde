import { pushSubscribeSchema, pushUnsubscribeSchema } from '@stryde/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { pushSubscriptions } from '../db/schema'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'

export const pushRoute = new Hono<AuthEnv>()
  .use(requireSession)
  // Store this browser's subscription. An endpoint is unique, so re-subscribing (or a
  // different account signing in on the same browser) moves it to the current user.
  .post('/subscribe', async (c) => {
    const parsed = pushSubscribeSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid subscription')
    const { endpoint, keys, userAgent } = parsed.data
    await db
      .insert(pushSubscriptions)
      .values({
        userId: c.get('user').id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? c.req.header('user-agent') ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: c.get('user').id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent ?? c.req.header('user-agent') ?? null,
        },
      })
    return c.json({ subscribed: true })
  })
  .delete('/subscribe', async (c) => {
    const parsed = pushUnsubscribeSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid subscription')
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, parsed.data.endpoint),
          eq(pushSubscriptions.userId, c.get('user').id),
        ),
      )
    return c.json({ subscribed: false })
  })
