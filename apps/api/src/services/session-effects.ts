import {
  type CalcSession,
  computeAllPRs,
  type ExerciseType,
  type FeedPR,
  NOTIFY_WINDOW_MS,
  type PrEvent,
  prTimeline,
  roundTo,
} from '@stryde/shared'
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  exercises,
  feedEvents,
  personalRecords,
  sessionExercises,
  sessions,
  sets,
} from '../db/schema'
import { publish } from './events'
import { friendIds } from './friend-graph'
import { friendWorkoutFinished } from './notify'

/**
 * Side effects after a push commits (DATA_MODEL_AND_SYNC.md §6), for the sessions and
 * exercises the push touched: PR recompute, then feed events. SSE hints arrive in
 * Phase 9.
 */
export async function onSessionsChanged(
  db: Db,
  userId: string,
  sessionIds: string[],
  exerciseIds: string[],
  now = new Date(),
): Promise<void> {
  await recomputePersonalRecords(db, userId, exerciseIds)
  await syncFeedEvents(db, userId, sessionIds, exerciseIds, now)
}

/**
 * Create, update or hide the feed event of each touched session, and refresh the PR
 * summary of the user's other events that share a touched exercise.
 */
export async function syncFeedEvents(
  db: Db,
  userId: string,
  sessionIds: string[],
  exerciseIds: string[],
  now = new Date(),
): Promise<void> {
  if (sessionIds.length > 0) {
    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), inArray(sessions.id, sessionIds)))
    const existing = new Set(
      (
        await db
          .select({ sessionId: feedEvents.sessionId })
          .from(feedEvents)
          .where(inArray(feedEvents.sessionId, sessionIds))
      ).map((e) => e.sessionId),
    )
    let feedChanged = false
    for (const session of rows) {
      const finishedAt = session.finishedAt
      const visible = finishedAt !== null && session.deletedAt === null && session.shareWithFriends
      if (!visible) {
        if (existing.has(session.id)) {
          await db
            .update(feedEvents)
            .set({ hidden: true })
            .where(eq(feedEvents.sessionId, session.id))
          feedChanged = true
        } else if (finishedAt !== null && session.deletedAt === null) {
          // Finished as a private workout: keep a hidden event so sharing it later is an
          // "unhide" (visible, no notification) and not a fresh finish (PRODUCT_SPEC.md §3).
          await db
            .insert(feedEvents)
            .values({ userId, sessionId: session.id, createdAt: finishedAt, hidden: true })
            .onConflictDoNothing()
        }
        continue
      }
      const prs = await sessionPRs(db, userId, session.id)
      if (existing.has(session.id)) {
        // Reshared or edited: visible again, no new notification.
        await db
          .update(feedEvents)
          .set({ hidden: false, createdAt: finishedAt, prs })
          .where(eq(feedEvents.sessionId, session.id))
        feedChanged = true
        continue
      }
      const inserted = await db
        .insert(feedEvents)
        .values({ userId, sessionId: session.id, createdAt: finishedAt, prs })
        .onConflictDoNothing()
        .returning({ id: feedEvents.id })
      if (inserted.length > 0) feedChanged = true
      if (inserted.length > 0 && now.getTime() - finishedAt.getTime() <= NOTIFY_WINDOW_MS) {
        await friendWorkoutFinished(db, { userId, sessionId: session.id, finishedAt })
      }
    }
    // Open feeds (mine and my friends') reload.
    if (feedChanged) publish([userId, ...(await friendIds(db, userId))], { type: 'feed' })
  }
  await refreshFeedPRs(db, userId, exerciseIds, new Set(sessionIds))
}

/** The user's finished sessions of one exercise, oldest first, as calc input. */
async function loadExerciseHistory(
  db: Db,
  userId: string,
  exerciseId: string,
): Promise<CalcSession[]> {
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
  return history
}

const toFeedPR = (e: PrEvent, exercise: { id: string; name: string }): FeedPR => ({
  exerciseId: exercise.id,
  exerciseName: exercise.name,
  prType: e.prType,
  value: roundTo(e.value, 2),
  previous: roundTo(e.previous, 2),
  ...(e.weightKg === undefined ? {} : { weightKg: e.weightKg }),
})

/** PRs achieved in one session, from each of its exercises' whole history. */
async function sessionPRs(db: Db, userId: string, sessionId: string): Promise<FeedPR[]> {
  const rows = await db
    .selectDistinct({ id: exercises.id, name: exercises.name, type: exercises.type })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(and(eq(sessionExercises.sessionId, sessionId), isNull(sessionExercises.deletedAt)))
  const prs: FeedPR[] = []
  for (const exercise of rows) {
    const history = await loadExerciseHistory(db, userId, exercise.id)
    for (const e of prTimeline(exercise.type as ExerciseType, history)) {
      if (e.sessionId === sessionId) prs.push(toFeedPR(e, exercise))
    }
  }
  return prs
}

/**
 * Editing or adding a session can change which earlier or later sessions hold a PR for
 * the same exercise, so their stored summaries are rebuilt for those exercises. Events
 * in `skip` were just computed in full.
 */
async function refreshFeedPRs(
  db: Db,
  userId: string,
  exerciseIds: string[],
  skip: Set<string>,
): Promise<void> {
  for (const exerciseId of exerciseIds) {
    const [exercise] = await db
      .select({ id: exercises.id, name: exercises.name, type: exercises.type })
      .from(exercises)
      .where(eq(exercises.id, exerciseId))
      .limit(1)
    if (!exercise) continue
    const history = await loadExerciseHistory(db, userId, exerciseId)
    const bySession = new Map<string, FeedPR[]>()
    for (const e of prTimeline(exercise.type as ExerciseType, history)) {
      const list = bySession.get(e.sessionId) ?? []
      list.push(toFeedPR(e, exercise))
      bySession.set(e.sessionId, list)
    }
    const ids = history.map((h) => h.sessionId).filter((id) => !skip.has(id))
    if (ids.length === 0) continue
    const events = await db
      .select({ sessionId: feedEvents.sessionId, prs: feedEvents.prs })
      .from(feedEvents)
      .where(inArray(feedEvents.sessionId, ids))
    for (const event of events) {
      const kept = (event.prs as FeedPR[]).filter((p) => p.exerciseId !== exerciseId)
      const next = [...kept, ...(bySession.get(event.sessionId) ?? [])]
      if (JSON.stringify(next) === JSON.stringify(event.prs)) continue
      await db
        .update(feedEvents)
        .set({ prs: next })
        .where(eq(feedEvents.sessionId, event.sessionId))
    }
  }
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
    const history = await loadExerciseHistory(db, userId, exerciseId)

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
