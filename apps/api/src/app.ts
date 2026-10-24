import { Hono } from 'hono'
import { healthRoute } from './routes/health'

// Runtime-agnostic app (no Bun APIs) so tests can call app.request() under Vitest.
export const app = new Hono().basePath('/api').route('/health', healthRoute)

export type AppType = typeof app
