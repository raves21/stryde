import { Hono } from 'hono'
import { auth } from './auth'
import { healthRoute } from './routes/health'
import { meRoute } from './routes/me'
import { usersRoute } from './routes/users'

// Runtime-agnostic app (no Bun APIs) so tests can call app.request() under Vitest.
export const app = new Hono()
  .basePath('/api')
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/health', healthRoute)
  .route('/me', meRoute)
  .route('/users', usersRoute)

export type AppType = typeof app
