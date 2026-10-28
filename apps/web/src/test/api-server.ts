import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import path from 'node:path'
import postgres from 'postgres'
import type { TestProject } from 'vitest/node'

// Vitest global setup: with DATABASE_URL set, runs the real API (Bun) against a fresh
// `<db>_web_test` database so sync tests can talk to it over HTTP. Without it, the
// tests that need it are skipped.

declare module 'vitest' {
  export interface ProvidedContext {
    apiUrl: string | null
  }
}

const API_DIR = path.resolve(import.meta.dirname, '../../../api')

async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0)
  await once(server, 'listening')
  const address = server.address()
  server.close()
  if (!address || typeof address === 'string') throw new Error('no port')
  return address.port
}

async function recreateDatabase(base: string): Promise<string> {
  const url = new URL(base)
  const name = `${url.pathname.slice(1).replace(/_test$/, '')}_web_test`
  const admin = new URL(base)
  admin.pathname = '/postgres'
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  await sql.unsafe(`CREATE DATABASE "${name}"`)
  await sql.end()
  url.pathname = `/${name}`
  return url.toString()
}

async function waitForHealth(url: string, child: ChildProcess, output: () => string) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited early:\n${output()}`)
    try {
      if ((await fetch(`${url}/api/health`)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`API did not start:\n${output()}`)
}

export default async function setup(project: TestProject) {
  const base = process.env.DATABASE_URL
  if (!base) {
    project.provide('apiUrl', null)
    return
  }
  const databaseUrl = await recreateDatabase(base)
  const port = await freePort()
  const child = spawn('bun', ['src/index.ts'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout?.on('data', (d) => {
    log += d
  })
  child.stderr?.on('data', (d) => {
    log += d
  })
  const apiUrl = `http://localhost:${port}`
  await waitForHealth(apiUrl, child, () => log)
  project.provide('apiUrl', apiUrl)

  return async () => {
    child.kill()
    if (child.exitCode === null) await once(child, 'exit')
  }
}
