import { Hono } from 'hono'
import { auth } from './auth'
import { env } from './env'
import { healthRoute } from './routes/health'
import { meRoute } from './routes/me'
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

/** The API plus, in the Docker image, the built SPA on the same origin. */
export function createApp(staticDir = env.staticDir) {
  const app = new Hono().route('/', api)
  if (staticDir) app.use('*', serveSpa(staticDir))
  return app
}

export const app = createApp()

export type AppType = typeof api
