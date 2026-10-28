import type { SessionExerciseRow, SessionRow } from '@stryde/shared'
import { localDateIn } from '@/lib/dates'
import { db as defaultDb, type StrydeDb } from '../db'
import { mutate, type RowPatch, type Writer } from './core'

const TABLES = ['sessions', 'sessionExercises', 'sets', 'userSettings'] as const

/** Start a session. Only one may be active at a time (PRODUCT_SPEC.md §4). */
export function startSession(
  input: Pick<SessionRow, 'name'> & Partial<Pick<SessionRow, 'templateId' | 'shareWithFriends'>>,
  db: StrydeDb = defaultDb,
) {
  return mutate(
    [...TABLES],
    async (w) => {
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
    },
    db,
  )
}

export function updateSession(id: string, patch: RowPatch<'sessions'>, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('sessions', id, patch), db)
}

export function finishSession(id: string, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => w.update('sessions', id, { finishedAt: w.now }), db)
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

export function updateSessionExercise(
  id: string,
  patch: RowPatch<'sessionExercises'>,
  db: StrydeDb = defaultDb,
) {
  return mutate([...TABLES], (w) => w.update('sessionExercises', id, patch), db)
}

export function removeSessionExercise(id: string, db: StrydeDb = defaultDb) {
  return mutate([...TABLES], (w) => deleteSessionExercises(w, [id]), db)
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
