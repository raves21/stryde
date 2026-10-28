import { type CalcSession, computeAllPRs, roundTo } from '@stryde/shared'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { exercises, personalRecords, sessionExercises, sessions, sets } from '../db/schema'

/**
 * Side effects after a push commits (DATA_MODEL_AND_SYNC.md §6), for the sessions and
 * exercises the push touched. Phase 5: PR recompute. Feed events, notifications and SSE
 * hints arrive in Phases 8–9.
 */
export async function onSessionsChanged(
  db: Db,
  userId: string,
  _sessionIds: string[],
  exerciseIds: string[],
): Promise<void> {
  await recomputePersonalRecords(db, userId, exerciseIds)
}

/**
 * Rebuild `personal_records` of each exercise from the user's whole finished history,
 * with the shared calc module, so edits and deletes can lower records.
 */
export async function recomputePersonalRecords(db: Db, userId: string, exerciseIds: string[]) {
  if (exerciseIds.length === 0) return
  const types = new Map(
    (
      await db
        .select({ id: exercises.id, type: exercises.type })
        .from(exercises)
        .where(inArray(exercises.id, exerciseIds))
    ).map((e) => [e.id, e.type]),
  )

  for (const exerciseId of exerciseIds) {
    const type = types.get(exerciseId)
    if (!type) continue
    const rows = await db
      .select({
        sessionId: sessions.id,
        localDate: sessions.localDate,
        finishedAt: sessions.finishedAt,
        set: sets,
      })
      .from(sets)
      .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
      .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessionExercises.exerciseId, exerciseId),
          isNotNull(sessions.finishedAt),
          isNull(sessions.deletedAt),
          isNull(sessionExercises.deletedAt),
          isNull(sets.deletedAt),
        ),
      )
      .orderBy(asc(sessions.startedAt), asc(sessionExercises.position), asc(sets.position))

    const history: CalcSession[] = []
    for (const r of rows) {
      let current = history.at(-1)
      if (current?.sessionId !== r.sessionId) {
        current = {
          sessionId: r.sessionId,
          date: r.localDate,
          at: (r.finishedAt ?? new Date()).toISOString(),
          sets: [],
        }
        history.push(current)
      }
      current.sets.push({
        id: r.set.id,
        setType: r.set.setType,
        weightKg: r.set.weightKg,
        reps: r.set.reps,
        rir: r.set.rir,
        durationSec: r.set.durationSec,
        completedAt: r.set.completedAt?.toISOString() ?? null,
        deletedAt: null,
      })
    }

    const records = computeAllPRs(type, history)
    await db.transaction(async (tx) => {
      await tx
        .delete(personalRecords)
        .where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId)))
      if (records.length === 0) return
      await tx.insert(personalRecords).values(
        records.map((r) => ({
          userId,
          exerciseId,
          prType: r.prType,
          value: roundTo(r.value, 2),
          setId: r.setId,
          sessionId: r.sessionId,
          achievedAt: new Date(r.achievedAt),
        })),
      )
    })
  }
}
