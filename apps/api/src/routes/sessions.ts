import { reactionBodySchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { isUuid } from '../lib/ids'
import { type AuthEnv, requireSession } from '../middleware/session'
import { listReactors, removeReaction, setReaction } from '../services/reactions'
import { getSessionDetail } from '../services/session-detail'

// Reading another user's session: an unauthorized or unknown id is always a 404.
const notFound = (c: Parameters<typeof apiError>[0]) =>
  apiError(c, 404, 'not_found', 'Workout not found')

export const sessionsRoute = new Hono<AuthEnv>()
  .use(requireSession)
  .get('/:id', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    const session = await getSessionDetail(db, c.get('user').id, id)
    return session ? c.json({ session }) : notFound(c)
  })
  .get('/:id/reactions', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    const reactors = await listReactors(db, c.get('user').id, id)
    return reactors ? c.json({ reactors }) : notFound(c)
  })
  .put('/:id/reaction', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    const parsed = reactionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'Unknown reaction')
    const result = await setReaction(db, c.get('user').id, id, parsed.data.emoji)
    return result ? c.json(result) : notFound(c)
  })
  .delete('/:id/reaction', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    const result = await removeReaction(db, c.get('user').id, id)
    return result ? c.json(result) : notFound(c)
  })
