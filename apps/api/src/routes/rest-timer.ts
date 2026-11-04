import { restTimerSchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { cancelRestPush, scheduleRestPush } from '../services/rest-timer'

export const restTimerRoute = new Hono<AuthEnv>()
  .use(requireSession)
  .post('/', async (c) => {
    const parsed = restTimerSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid rest timer')
    const result = await scheduleRestPush(
      db,
      c.get('user').id,
      parsed.data.sessionId,
      new Date(parsed.data.fireAt),
    )
    if ('error' in result) {
      return apiError(c, result.error.status, result.error.code, result.error.message)
    }
    return c.json(result)
  })
  .delete('/', async (c) => {
    await cancelRestPush(db, c.get('user').id)
    return c.json({ cancelled: true })
  })
