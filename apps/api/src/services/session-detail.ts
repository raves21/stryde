import type { FeedPR, SessionDetail } from '@stryde/shared'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { exercises, feedEvents, sessionExercises, sets, user } from '../db/schema'
import { canViewSession } from './access'
import { publicProfile } from './friends'
import { reactionSummary } from './reactions'

/**
 * A session as its owner or an accepted friend sees it (completed sets only), with the
 * exercise names even when the exercise is the owner's custom one. Null when the viewer
 * can't see it (the route answers 404).
 */
export async function getSessionDetail(
  db: Db,
  me: string,
  sessionId: string,
): Promise<SessionDetail | null> {
  const session = await canViewSession(db, me, sessionId)
  if (!session?.finishedAt) return null

  const [owner] = await db.select().from(user).where(eq(user.id, session.userId)).limit(1)
  if (!owner) return null

  const exerciseRows = await db
    .select({ se: sessionExercises, exercise: exercises })
    .from(sessionExercises)
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(and(eq(sessionExercises.sessionId, sessionId), isNull(sessionExercises.deletedAt)))
    .orderBy(asc(sessionExercises.position))
  const setRows =
    exerciseRows.length === 0
      ? []
      : await db
          .select()
          .from(sets)
          .where(
            and(
              inArray(
                sets.sessionExerciseId,
                exerciseRows.map((r) => r.se.id),
              ),
              isNull(sets.deletedAt),
              isNotNull(sets.completedAt),
            ),
          )
          .orderBy(asc(sets.position))

  const [event] = await db
    .select({ prs: feedEvents.prs })
    .from(feedEvents)
    .where(eq(feedEvents.sessionId, sessionId))
    .limit(1)
  const reacted = (await reactionSummary(db, me, [sessionId])).get(sessionId)

  return {
    id: session.id,
    owner: { ...publicProfile(owner), userId: owner.id, isMe: owner.id === me },
    name: session.name,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt.toISOString(),
    notes: session.notes,
    prs: (event?.prs ?? []) as FeedPR[],
    exercises: exerciseRows.map(({ se, exercise }) => ({
      id: se.id,
      exerciseId: exercise.id,
      name: exercise.name,
      type: exercise.type,
      position: se.position,
      supersetGroup: se.supersetGroup,
      sets: setRows
        .filter((s) => s.sessionExerciseId === se.id)
        .map((s) => ({
          id: s.id,
          position: s.position,
          setType: s.setType,
          targetKind: s.targetKind,
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          durationSec: s.durationSec,
        })),
    })),
    reactions: reacted?.counts ?? {},
    myReaction: reacted?.mine ?? null,
  }
}
