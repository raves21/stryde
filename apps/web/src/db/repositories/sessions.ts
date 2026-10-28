import type { ExerciseRow, SessionExerciseRow, SessionRow, SetRow } from '@stryde/shared'
import { localDateIn } from '@/lib/dates'
import { templateToSession } from '@/lib/template-to-session'
import { matchPrevious, prefill } from '@/lib/workout'
import { db as defaultDb, type StrydeDb } from '../db'
import { newId } from '../ids'
import { mutate, type NewRow, type RowPatch, type Writer } from './core'
import { applyPlan, asPlan, nextFreeLetter, planOrder, planUngroup } from './supersets'
import { getTemplateTree } from './templates'

// Everything a workout reads or writes, so each call is one transaction.
const TABLES = [
  'sessions',
  'sessionExercises',
  'sets',
  'exercises',
  'templates',
  'templateExercises',
  'templateSets',
  'userSettings',
] as const

/** Start a session. Only one may be active at a time (PRODUCT_SPEC.md §4.3). */
export function startSession(
  input: Pick<SessionRow, 'name'> & Partial<Pick<SessionRow, 'templateId' | 'shareWithFriends'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate([...TABLES], (w) => insertSession(w, input), db)
}

async function insertSession(
  w: Writer,
  input: Pick<SessionRow, 'name'> & Partial<Pick<SessionRow, 'templateId' | 'shareWithFriends'>>,
) {
  if ((await activeSessions(w.db)).length > 0) throw new Error('A workout is already active')
  const settings = await w.get('userSettings', w.userId)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return w.insert('sessions', {
    templateId: null,
    shareWithFriends: settings?.defaultShareWithFriends ?? true,
    ...input,
    startedAt: w.now,
    finishedAt: null,
    timezone,
    localDate: localDateIn(new Date(w.now), timezone),
    notes: null,
  })
}

/** Start an empty workout named "Workout". */
export function startEmptySession(db: StrydeDb = defaultDb) {
  return startSession({ name: 'Workout' }, db)
}

/**
 * Start from a template: copies exercises, supersets, rest and targets, and pre-fills
 * weights/reps from the previous session (PRODUCT_SPEC.md §4.3).
 */
export function startSessionFromTemplate(templateId: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      if ((await activeSessions(w.db)).length > 0) throw new Error('A workout is already active')
      const tree = await getTemplateTree(templateId, w.db)
      if (!tree) throw new Error('Template not found')
      const settings = await w.get('userSettings', w.userId)
      // The new session has no rows yet, so nothing needs excluding.
      const previousSets = new Map<string, SetRow[]>()
      for (const { row } of tree.exercises) {
        previousSets.set(row.exerciseId, await previousSetsOf(w.db, row.exerciseId, ''))
      }
      const rows = templateToSession(tree, {
        userId: w.userId,
        now: new Date(w.now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        shareWithFriends: settings?.defaultShareWithFriends ?? true,
        newId,
        previousSets,
      })
      const session = await w.insert('sessions', rows.session)
      for (const se of rows.sessionExercises) await w.insert('sessionExercises', se)
      for (const set of rows.sets) await w.insert('sets', set)
      return session
    },
    db,
  )
}

export function updateSession(id: string, patch: RowPatch<'sessions'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('sessions', id, patch), db)
}

/** Change start/finish times; the calendar day follows the start in the session's timezone. */
export function updateSessionTimes(
  id: string,
  startedAt: string,
  finishedAt: string | null,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      const session = await w.get('sessions', id)
      if (!session) throw new Error('Session not found')
      return w.update('sessions', id, {
        startedAt,
        finishedAt,
        localDate: localDateIn(new Date(startedAt), session.timezone),
      })
    },
    db,
  )
}

export function finishSession(id: string, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('sessions', id, { finishedAt: w.now }), db)
}

/**
 * Finish an active workout (UI_DESIGN.md §5.5): incomplete sets are discarded, and so are
 * exercises left without completed sets; then `finishedAt` is set.
 */
export function finishWorkout(
  id: string,
  { notes, shareWithFriends }: Pick<SessionRow, 'notes' | 'shareWithFriends'>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      for (const se of await getSessionExercises(id, w.db)) {
        const sets = await getSets(se.id, w.db)
        const incomplete = sets.filter((s) => s.completedAt === null).map((s) => s.id)
        if (incomplete.length === sets.length) await deleteSessionExercises(w, [se.id])
        else await w.softDelete('sets', incomplete)
      }
      await applyPlan(w, 'sessionExercises', asPlan(await getSessionExercises(id, w.db)))
      return w.update('sessions', id, { finishedAt: w.now, notes, shareWithFriends })
    },
    db,
  )
}

/** Soft-deletes the session with its exercises and sets (also used to discard). */
export function deleteSession(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const children = await w.db.sessionExercises.where('sessionId').equals(id).primaryKeys()
      await deleteSessionExercises(w, children)
      await w.softDelete('sessions', [id])
    },
    db,
  )
}

export function addSessionExercise(
  input: Pick<SessionExerciseRow, 'sessionId' | 'exerciseId' | 'position'> &
    Partial<Pick<SessionExerciseRow, 'supersetGroup' | 'restSeconds'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    (w) => w.insert('sessionExercises', { supersetGroup: null, restSeconds: null, ...input }),
    db,
  )
}

/** Add an exercise at the end with one working set pre-filled from last time. */
export function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      const position = (await getSessionExercises(sessionId, w.db)).length
      const se = await w.insert('sessionExercises', {
        sessionId,
        exerciseId,
        position,
        supersetGroup: null,
        restSeconds: null,
      })
      await insertNextSet(w, se, [])
      return se
    },
    db,
  )
}

export function updateSessionExercise(
  id: string,
  patch: RowPatch<'sessionExercises'>,
  db: StrydeDb = defaultDb,
) {
  return mutate([...TABLES], (w) => w.update('sessionExercises', id, patch), db)
}

/** Swap the exercise, keeping its sets. */
export function replaceSessionExercise(id: string, exerciseId: string, db: StrydeDb = defaultDb) {
  return updateSessionExercise(id, { exerciseId }, db)
}

export function removeSessionExercise(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const row = await w.get('sessionExercises', id)
      if (!row) return
      await deleteSessionExercises(w, [id])
      await applyPlan(w, 'sessionExercises', asPlan(await getSessionExercises(row.sessionId, w.db)))
    },
    db,
  )
}

export function reorderSessionExercises(
  sessionId: string,
  orderedIds: string[],
  movedId?: string,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
      const rows = await getSessionExercises(sessionId, w.db)
      await applyPlan(w, 'sessionExercises', planOrder(rows, orderedIds), movedId)
    },
    db,
  )
}

/** Superset this exercise with the next one (joining an existing group if either has one). */
export function supersetWithNext(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const row = await w.get('sessionExercises', id)
      if (!row) return
      const rows = await getSessionExercises(row.sessionId, w.db)
      const index = rows.findIndex((r) => r.id === id)
      const next = rows[index + 1]
      if (!next) throw new Error('No exercise after this one')
      const group = row.supersetGroup ?? next.supersetGroup ?? nextFreeLetter(rows)
      const plan = asPlan(rows).map((p) =>
        p.row.id === id || p.row.id === next.id ? { ...p, group } : p,
      )
      await applyPlan(w, 'sessionExercises', plan)
    },
    db,
  )
}

export function removeFromSuperset(id: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const row = await w.get('sessionExercises', id)
      if (!row) return
      const rows = await getSessionExercises(row.sessionId, w.db)
      await applyPlan(w, 'sessionExercises', planUngroup(rows, [id]))
    },
    db,
  )
}

/** Add a set copying the last one's type and targets, pre-filled from last time. */
export function addSetToExercise(sessionExerciseId: string, db: StrydeDb = defaultDb) {
  return mutate(
    [...TABLES],
    async (w) => {
      const se = await w.get('sessionExercises', sessionExerciseId)
      if (!se) throw new Error('Exercise not found')
      return insertNextSet(w, se, await getSets(se.id, w.db))
    },
    db,
  )
}

async function insertNextSet(w: Writer, se: SessionExerciseRow, sets: SetRow[]) {
  const last = sets.at(-1)
  const draft: Pick<
    SetRow,
    'setType' | 'targetKind' | 'targetReps' | 'targetRepsMax' | 'targetRir'
  > = {
    setType: last?.setType === 'warmup' ? 'working' : (last?.setType ?? 'working'),
    targetKind: last?.targetKind ?? 'fixed',
    targetReps: last?.targetReps ?? null,
    targetRepsMax: last?.targetRepsMax ?? null,
    targetRir: last?.targetRir ?? null,
  }
  const previous = matchPrevious(
    [...sets, draft],
    await previousSetsOf(w.db, se.exerciseId, se.sessionId),
  ).at(-1)
  // Without history, keep going with what the last set used.
  const planned = { weightKg: last?.weightKg ?? null, durationSec: last?.durationSec ?? null }
  const values: NewRow<'sets'> = {
    sessionExerciseId: se.id,
    position: (last?.position ?? -1) + 1,
    ...draft,
    ...prefill(draft, previous, planned),
    completedAt: null,
  }
  return w.insert('sets', values)
}

async function deleteSessionExercises(w: Writer, ids: string[]) {
  const sets = await w.db.sets.where('sessionExerciseId').anyOf(ids).primaryKeys()
  await w.softDelete('sets', sets)
  await w.softDelete('sessionExercises', ids)
}

async function activeSessions(db: StrydeDb): Promise<SessionRow[]> {
  return db.sessions.filter((s) => !s.deletedAt && s.finishedAt === null).sortBy('startedAt')
}

/**
 * Unfinished, undeleted sessions, oldest first. More than one only happens when two
 * devices each started a workout offline (DATA_MODEL_AND_SYNC.md §8).
 */
export function listActiveSessions(db: StrydeDb = defaultDb): Promise<SessionRow[]> {
  return activeSessions(db)
}

export async function getActiveSession(db: StrydeDb = defaultDb): Promise<SessionRow | undefined> {
  return (await activeSessions(db))[0]
}

export async function getSession(id: string, db: StrydeDb = defaultDb) {
  const row = await db.sessions.get(id)
  return row && !row.deletedAt ? row : undefined
}

export async function getSessionExercises(
  sessionId: string,
  db: StrydeDb = defaultDb,
): Promise<SessionExerciseRow[]> {
  const rows = await db.sessionExercises
    .where('[sessionId+position]')
    .between([sessionId, -Infinity], [sessionId, Infinity])
    .toArray()
  return rows.filter((r) => !r.deletedAt)
}

async function getSets(sessionExerciseId: string, db: StrydeDb): Promise<SetRow[]> {
  const rows = await db.sets
    .where('[sessionExerciseId+position]')
    .between([sessionExerciseId, -Infinity], [sessionExerciseId, Infinity])
    .toArray()
  return rows.filter((r) => !r.deletedAt)
}

/**
 * Completed sets of `exerciseId` in its most recent finished session (other than
 * `excludeSessionId`), in order: the "previous" column and pre-fill source.
 */
async function previousSetsOf(
  db: StrydeDb,
  exerciseId: string,
  excludeSessionId: string,
): Promise<SetRow[]> {
  const ses = (await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray()).filter(
    (se) => !se.deletedAt && se.sessionId !== excludeSessionId,
  )
  const sessions = (await db.sessions.bulkGet([...new Set(ses.map((se) => se.sessionId))])).filter(
    (s): s is SessionRow => !!s && !s.deletedAt && s.finishedAt !== null,
  )
  const latest = sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  if (!latest) return []
  const mine = ses
    .filter((se) => se.sessionId === latest.id)
    .sort((a, b) => a.position - b.position)
  const sets: SetRow[] = []
  for (const se of mine) {
    sets.push(...(await getSets(se.id, db)).filter((s) => s.completedAt !== null))
  }
  return sets
}

export function getPreviousSets(
  exerciseId: string,
  excludeSessionId: string,
  db: StrydeDb = defaultDb,
): Promise<SetRow[]> {
  return previousSetsOf(db, exerciseId, excludeSessionId)
}

export type SessionTree = {
  session: SessionRow
  exercises: {
    row: SessionExerciseRow
    exercise: ExerciseRow | undefined
    sets: SetRow[]
    /** Completed sets from last time, matched to `sets` by position (warm-ups apart). */
    previous: (SetRow | undefined)[]
  }[]
}

/** A session with its exercises (in order), sets and "previous" values. */
export async function getSessionTree(
  id: string,
  db: StrydeDb = defaultDb,
): Promise<SessionTree | undefined> {
  const session = await getSession(id, db)
  if (!session) return undefined
  const rows = await getSessionExercises(id, db)
  const exercises = await Promise.all(
    rows.map(async (row) => {
      const sets = await getSets(row.id, db)
      return {
        row,
        exercise: await db.exercises.get(row.exerciseId),
        sets,
        previous: matchPrevious(sets, await previousSetsOf(db, row.exerciseId, id)),
      }
    }),
  )
  return { session, exercises }
}

/**
 * Sets of `exerciseId` per earlier finished session (oldest first), excluding
 * `excludeSessionId`: the history PR detection compares against.
 */
export async function getExerciseHistory(
  exerciseId: string,
  excludeSessionId: string,
  db: StrydeDb = defaultDb,
): Promise<SetRow[][]> {
  const ses = (await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray()).filter(
    (se) => !se.deletedAt && se.sessionId !== excludeSessionId,
  )
  const sessions = (await db.sessions.bulkGet([...new Set(ses.map((se) => se.sessionId))]))
    .filter((s): s is SessionRow => !!s && !s.deletedAt && s.finishedAt !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const history: SetRow[][] = []
  for (const session of sessions) {
    const sets: SetRow[] = []
    for (const se of ses.filter((x) => x.sessionId === session.id))
      sets.push(...(await getSets(se.id, db)))
    history.push(sets)
  }
  return history
}
