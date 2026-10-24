import path from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import type { Db } from './client'
import { seedPresetExercises } from './seed/exercises'

const migrationsFolder = path.join(import.meta.dirname, 'migrations')

/** Apply pending migrations, then upsert presets. Runs on every API boot. */
export async function migrateAndSeed(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder })
  await seedPresetExercises(db)
}
