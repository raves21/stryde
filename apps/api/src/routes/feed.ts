import { feedQuerySchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { getFeed } from '../services/feed'

export const feedRoute = new Hono<AuthEnv>().use(requireSession).get('/', async (c) => {
  const parsed = feedQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Invalid cursor or limit')
  return c.json(await getFeed(db, c.get('user').id, parsed.data))
})
