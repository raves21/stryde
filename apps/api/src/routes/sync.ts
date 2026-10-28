import { pullQuerySchema, pushRequestSchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { pullChanges, pushChanges } from '../services/sync'

export const syncRoute = new Hono<AuthEnv>()
  .use(requireSession)
  .post('/push', async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const parsed = pushRequestSchema.safeParse(body)
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid push request')
    const results = await pushChanges(db, c.get('user').id, parsed.data.mutations)
    return c.json({ results })
  })
  .get('/pull', async (c) => {
    const parsed = pullQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid cursor or limit')
    const { cursor, limit } = parsed.data
    return c.json(await pullChanges(db, c.get('user').id, cursor, limit))
  })
