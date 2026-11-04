import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { type AuthEnv, requireSession } from '../middleware/session'
import { subscribe } from '../services/events'

/** Comment line every 25 s keeps Cloudflare (idle timeout ~100 s) from closing the stream. */
export const HEARTBEAT_MS = 25_000

/**
 * `GET /api/events`: server-sent events for the signed-in user (`sync`, `feed`,
 * `notification`). Hints only: the client refetches, nothing here carries data.
 */
export const createEventsRoute = (heartbeatMs = HEARTBEAT_MS) =>
  new Hono<AuthEnv>().use(requireSession).get('/', (c) => {
    const userId = c.get('user').id
    c.header('X-Accel-Buffering', 'no')
    return streamSSE(c, async (stream) => {
      const unsubscribe = subscribe(userId, (event) => {
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
      })
      stream.onAbort(unsubscribe)
      await stream.writeSSE({ event: 'ready', data: '{}' })
      while (!stream.aborted) {
        await stream.sleep(heartbeatMs)
        if (stream.aborted) break
        await stream.write(': ping\n\n')
      }
      unsubscribe()
    })
  })

export const eventsRoute = createEventsRoute()
