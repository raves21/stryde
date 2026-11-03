import { isValidUsername, normalizeUsername, userSearchQuerySchema } from '@stryde/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { user } from '../db/schema'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { searchUsers } from '../services/friends'

export const usersRoute = new Hono<AuthEnv>()
  .get('/username-available', async (c) => {
    const username = normalizeUsername(c.req.query('u') ?? '')
    if (!isValidUsername(username)) return c.json({ username, available: false, valid: false })
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, username))
      .limit(1)
    return c.json({ username, available: !existing, valid: true })
  })
  // Username prefix search for "add friend": public profile only, max 10.
  .get('/search', requireSession, async (c) => {
    const parsed = userSearchQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Enter a username')
    return c.json({ users: await searchUsers(db, c.get('user').id, parsed.data.q) })
  })
