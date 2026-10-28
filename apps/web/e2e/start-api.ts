// Starts the API for e2e runs: recreates `<db>_e2e` (from DATABASE_URL, defaulting to
// the dev database) and runs the API on E2E_API_PORT. The API migrates and seeds on boot.
import { spawn } from 'node:child_process'
import path from 'node:path'
import postgres from 'postgres'

const base = process.env.DATABASE_URL ?? 'postgres://stryde:stryde@localhost:5432/stryde'
const url = new URL(base)
const name = `${url.pathname.slice(1).replace(/_test$/, '')}_e2e`
const admin = new URL(base)
admin.pathname = '/postgres'
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
await sql.unsafe(`CREATE DATABASE "${name}"`)
await sql.end()
url.pathname = `/${name}`

const child = spawn('bun', ['src/index.ts'], {
  cwd: path.resolve(import.meta.dirname, '../../api'),
  env: {
    ...process.env,
    DATABASE_URL: url.toString(),
    PORT: process.env.E2E_API_PORT ?? '3100',
    // Better Auth only accepts requests from its own origin.
    PUBLIC_URL: `http://localhost:${process.env.E2E_WEB_PORT ?? '5180'}`,
  },
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 0))
