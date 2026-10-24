import postgres from 'postgres'
import { createDb } from '../db/client'
import { migrateAndSeed } from '../db/migrate'
import { toTestDatabaseUrl } from './database-url'

/** Recreates `<db>_test` and applies migrations + seed once per test run. */
export default async function setup() {
  const base = process.env.DATABASE_URL
  if (!base) return
  const testUrl = toTestDatabaseUrl(base)
  const testName = new URL(testUrl).pathname.slice(1)

  const adminUrl = new URL(base)
  adminUrl.pathname = '/postgres'
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
  await admin.unsafe(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`)
  await admin.unsafe(`CREATE DATABASE "${testName}"`)
  await admin.end()

  const { db, client } = createDb(testUrl)
  await migrateAndSeed(db)
  await client.end()
}
