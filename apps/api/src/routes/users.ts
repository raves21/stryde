import { isValidUsername, normalizeUsername } from '@stryde/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client'
import { user } from '../db/schema'

export const usersRoute = new Hono().get('/username-available', async (c) => {
  const username = normalizeUsername(c.req.query('u') ?? '')
  if (!isValidUsername(username)) return c.json({ username, available: false, valid: false })
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1)
  return c.json({ username, available: !existing, valid: true })
})
