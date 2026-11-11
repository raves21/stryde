import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { exercises, sessionExercises, sets } from '../db/schema'

/**
 * Seconds played in sport sessions: the sum of their completed games (pauses and breaks are not
 * counted). Only sessions made of sports alone get an entry (sports are always their own
 * session), so `has(id)` also tells a sport session from a workout.
 */
export async function playSeconds(db: Db, sessionIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (sessionIds.length === 0) return out
  const rows = await db
    .select({
      sessionId: sessionExercises.sessionId,
      type: exercises.type,
      seconds: sql<number>`coalesce(sum(${sets.durationSec}), 0)::int`,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(
      and(
        inArray(sessionExercises.sessionId, sessionIds),
        isNull(sessionExercises.deletedAt),
        isNull(sets.deletedAt),
        isNotNull(sets.completedAt),
      ),
    )
    .groupBy(sessionExercises.sessionId, exercises.type)
  const types = new Map<string, Set<string>>()
  for (const r of rows) types.set(r.sessionId, (types.get(r.sessionId) ?? new Set()).add(r.type))
  for (const r of rows) {
    const t = types.get(r.sessionId)
    if (t?.size === 1 && t.has('sport')) out.set(r.sessionId, r.seconds)
  }
  return out
}
