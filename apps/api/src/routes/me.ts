import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { type AuthEnv, requireSession } from '../middleware/session'
import { getUserSettings } from '../services/user-settings'

export const meRoute = new Hono<AuthEnv>().get('/', requireSession, async (c) => {
  const user = c.get('user')
  const settings = await getUserSettings(db, user.id)
  if (!settings) return apiError(c, 500, 'settings_missing', 'User settings not found')
  const username = typeof user.username === 'string' ? user.username : null
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username,
      displayName: user.name,
      avatarUrl: user.image ?? null,
      createdAt: user.createdAt,
    },
    settings,
    needsOnboarding: username === null,
  })
})
