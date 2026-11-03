import { sendFriendRequestSchema } from '@stryde/shared'
import { Hono } from 'hono'
import { db } from '../db/client'
import { apiError } from '../lib/errors'
import { isUuid } from '../lib/ids'
import { type AuthEnv, requireSession } from '../middleware/session'
import {
  answerRequest,
  type Failure,
  isFailure,
  listFriends,
  listRequests,
  removeFriend,
  sendRequest,
  setMute,
} from '../services/friends'

const notFound = (c: Parameters<typeof apiError>[0]) => apiError(c, 404, 'not_found', 'Not found')

export const friendsRoute = new Hono<AuthEnv>()
  .use(requireSession)
  .get('/', async (c) => c.json({ friends: await listFriends(db, c.get('user').id) }))
  .get('/requests', async (c) => c.json(await listRequests(db, c.get('user').id)))
  .post('/requests', async (c) => {
    const parsed = sendFriendRequestSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return apiError(c, 400, 'invalid_request', 'A username is required')
    return respond(c, await sendRequest(db, c.get('user').id, parsed.data.username))
  })
  .post('/requests/:id/accept', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    return respond(c, await answerRequest(db, c.get('user').id, id, 'accepted'))
  })
  .post('/requests/:id/decline', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return notFound(c)
    return respond(c, await answerRequest(db, c.get('user').id, id, 'declined'))
  })
  .delete('/:userId', async (c) => {
    const otherId = c.req.param('userId')
    if (!isUuid(otherId)) return notFound(c)
    return respond(c, await removeFriend(db, c.get('user').id, otherId))
  })
  .put('/:userId/mute', async (c) => {
    const friendId = c.req.param('userId')
    if (!isUuid(friendId)) return notFound(c)
    return respond(c, await setMute(db, c.get('user').id, friendId, true))
  })
  .delete('/:userId/mute', async (c) => {
    const friendId = c.req.param('userId')
    if (!isUuid(friendId)) return notFound(c)
    return respond(c, await setMute(db, c.get('user').id, friendId, false))
  })

function respond(c: Parameters<typeof apiError>[0], result: object | Failure) {
  if (isFailure(result)) {
    const { status, code, message } = result.error
    return apiError(c, status, code, message)
  }
  return c.json(result)
}
