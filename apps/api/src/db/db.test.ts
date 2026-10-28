import { eq, max, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, describe, expect, it } from 'vitest'
import { hasDatabase } from '../test/helpers'
import { client, db } from './client'
import { exercises, sessionExercises, sessions, templates, user } from './schema'
import { PRESET_EXERCISES, seedPresetExercises } from './seed/exercises'

describe.skipIf(!hasDatabase)('database', () => {
  afterAll(() => client.end())

  async function createUser() {
    const [row] = await db
      .insert(user)
      .values({ name: 'DB Test', email: `db_${uuidv7()}@example.com` })
      .returning({ id: user.id })
    if (!row) throw new Error('user insert failed')
    return row.id
  }

  it('applies migrations: every synced table has the serverVersion trigger', async () => {
    const rows = await db.execute<{ tgname: string }>(
      sql`SELECT tgname FROM pg_trigger WHERE tgname LIKE '%_server_version' ORDER BY tgname`,
    )
    expect(rows.map((r) => r.tgname)).toEqual([
      'exercises_server_version',
      'session_exercises_server_version',
      'sessions_server_version',
      'sets_server_version',
      'template_exercises_server_version',
      'template_sets_server_version',
      'templates_server_version',
      'user_settings_server_version',
    ])
  })

  it('seeds presets idempotently without bumping serverVersion', async () => {
    const before = await db
      .select({ count: sql<number>`count(*)::int`, maxVersion: max(exercises.serverVersion) })
      .from(exercises)
      .where(eq(exercises.isPreset, true))
    await seedPresetExercises(db)
    await seedPresetExercises(db)
    const after = await db
      .select({ count: sql<number>`count(*)::int`, maxVersion: max(exercises.serverVersion) })
      .from(exercises)
      .where(eq(exercises.isPreset, true))
    expect(after[0]?.count).toBe(PRESET_EXERCISES.length)
    expect(after).toEqual(before)
  })

  it('preset ids are unique and cover every muscle group and type', () => {
    expect(new Set(PRESET_EXERCISES.map((p) => p.id)).size).toBe(PRESET_EXERCISES.length)
    expect(new Set(PRESET_EXERCISES.map((p) => p.muscleGroup)).size).toBe(14)
    expect(new Set(PRESET_EXERCISES.map((p) => p.type))).toEqual(
      new Set(['weighted', 'bodyweight', 'timed']),
    )
  })

  it('assigns an increasing serverVersion on insert and update', async () => {
    const userId = await createUser()
    const id = uuidv7()
    const now = new Date()
    const [inserted] = await db
      .insert(templates)
      .values({ id, userId, name: 'Push Day', createdAt: now, updatedAt: now })
      .returning({ v: templates.serverVersion })
    const [updated] = await db
      .update(templates)
      .set({ name: 'Push Day A', updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning({ v: templates.serverVersion })
    expect(inserted?.v).toBeGreaterThan(0)
    expect(updated?.v).toBeGreaterThan(inserted?.v ?? Number.POSITIVE_INFINITY)
  })

  it('defers synced foreign keys so children can be written before parents', async () => {
    const userId = await createUser()
    const sessionId = uuidv7()
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.insert(sessionExercises).values({
        id: uuidv7(),
        userId,
        sessionId,
        exerciseId: PRESET_EXERCISES[0]?.id ?? '',
        position: 0,
        createdAt: now,
        updatedAt: now,
      })
      await tx.insert(sessions).values({
        id: sessionId,
        userId,
        name: 'Workout',
        startedAt: now,
        timezone: 'Asia/Manila',
        localDate: '2026-10-24',
        createdAt: now,
        updatedAt: now,
      })
    })
    const rows = await db
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId))
    expect(rows).toHaveLength(1)
  })

  it('rejects a dangling foreign key at commit', async () => {
    const userId = await createUser()
    const now = new Date()
    await expect(
      db.insert(sessionExercises).values({
        id: uuidv7(),
        userId,
        sessionId: uuidv7(),
        exerciseId: PRESET_EXERCISES[0]?.id ?? '',
        position: 0,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow()
  })

  it('accepts two active sessions per user (resolved on the client)', async () => {
    const userId = await createUser()
    const base = {
      userId,
      name: 'Workout',
      timezone: 'UTC',
      localDate: '2026-10-24',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.insert(sessions).values({ ...base, id: uuidv7() })
    await db.insert(sessions).values({ ...base, id: uuidv7() })
  })
})
