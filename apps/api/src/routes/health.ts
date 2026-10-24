import { Hono } from 'hono'

export const healthRoute = new Hono().get('/', (c) =>
  c.json({ ok: true, version: process.env.GIT_SHA ?? 'dev' }),
)
