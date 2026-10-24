import { app } from './app'

const port = Number(process.env.PORT ?? 3000)

// Bun closes idle connections after 10 s by default; SSE (Phase 9) heartbeats every 25 s.
// 255 s is Bun's maximum.
export default {
  port,
  idleTimeout: 255,
  fetch: app.fetch,
}

console.log(`api listening on http://localhost:${port}`)
