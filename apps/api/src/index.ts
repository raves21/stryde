import { app } from './app'
import { db } from './db/client'
import { migrateAndSeed } from './db/migrate'
import { env } from './env'
import { startRestPushScheduler } from './services/rest-timer'

// Migrations and preset seed run before the server starts listening.
await migrateAndSeed(db)

// Rest-timer pushes are sent by an in-process loop (single instance).
startRestPushScheduler(db)

// Bun closes idle connections after 10 s by default; SSE heartbeats every 25 s.
// 255 s is Bun's maximum.
export default {
  port: env.port,
  idleTimeout: 255,
  fetch: app.fetch,
}

console.log(`api listening on http://localhost:${env.port}`)
