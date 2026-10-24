import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userSettings } from '../db/schema'

/** Insert the user_settings row (id = userId) with defaults. No-op if it exists. */
export async function createDefaultUserSettings(db: Db, userId: string): Promise<void> {
  const now = new Date()
  await db
    .insert(userSettings)
    .values({ id: userId, userId, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: userSettings.id })
}

export async function getUserSettings(db: Db, userId: string) {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.id, userId)).limit(1)
  return row ?? null
}
