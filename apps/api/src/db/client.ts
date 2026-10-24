import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env'
import * as schema from './schema'

export function createDb(url: string) {
  // postgres.js connects lazily on the first query.
  const client = postgres(url, { max: 10, onnotice: () => {} })
  return { db: drizzle(client, { schema }), client }
}

export type Db = ReturnType<typeof createDb>['db']

export const { db, client } = createDb(env.databaseUrl)
