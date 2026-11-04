import { markReadSchema, notificationsQuerySchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { listNotifications, markRead } from '../services/notifications'

export const notificationsRoute = new Hono<AuthEnv>()
  .use(requireSession)
  .get('/', async (c) => {
    const parsed = notificationsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid cursor or limit')
    return c.json(await listNotifications(db, c.get('user').id, parsed.data))
  })
  .post('/read', async (c) => {
    const parsed = markReadSchema.safeParse((await c.req.json().catch(() => ({}))) ?? {})
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid ids')
    return c.json({ updated: await markRead(db, c.get('user').id, parsed.data.ids) })
  })
