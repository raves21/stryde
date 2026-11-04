import { Hono } from 'hono'
import { auth } from './auth'
import { env } from './env'
import { configRoute } from './routes/config'
import { eventsRoute } from './routes/events'
import { feedRoute } from './routes/feed'
import { friendsRoute } from './routes/friends'
import { healthRoute } from './routes/health'
import { meRoute } from './routes/me'
import { notificationsRoute } from './routes/notifications'
import { pushRoute } from './routes/push'
import { restTimerRoute } from './routes/rest-timer'
import { sessionsRoute } from './routes/sessions'
import { syncRoute } from './routes/sync'
import { usersRoute } from './routes/users'
import { serveSpa } from './static'

// Runtime-agnostic app (no Bun APIs) so tests can call app.request() under Vitest.
const api = new Hono()
  .basePath('/api')
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/health', healthRoute)
  .route('/me', meRoute)
  .route('/users', usersRoute)
  .route('/sync', syncRoute)
  .route('/friends', friendsRoute)
  .route('/feed', feedRoute)
  .route('/sessions', sessionsRoute)
  .route('/config', configRoute)
  .route('/push', pushRoute)
  .route('/notifications', notificationsRoute)
  .route('/rest-timer', restTimerRoute)
  .route('/events', eventsRoute)

/** The API plus, in the Docker image, the built SPA on the same origin. */
export function createApp(staticDir = env.staticDir) {
  const app = new Hono().route('/', api)
  if (staticDir) app.use('*', serveSpa(staticDir))
  return app
}

export const app = createApp()

export type AppType = typeof api
