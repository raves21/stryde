import {
  type ExerciseType,
  type MutationResult,
  type PullResponse,
  SYNC_TABLES,
  type SyncChange,
  type SyncTable,
  setCompletionError,
  syncRowSchemas,
} from '@stryde/shared'
import { and, eq, getTableColumns, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  exercises,
  sessionExercises,
  sessions,
  sets,
  syncedTables,
  templateExercises,
  templateSets,
  templates,
  userSettings,
} from '../db/schema'
import { onSessionsChanged } from './session-effects'

// Sync protocol, server side (DATA_MODEL_AND_SYNC.md §5).

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type RawMutation = { table: SyncTable; row: Record<string, unknown> }

/** Clients may be ahead of the server clock by at most this much. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

/** Columns referencing another synced row the user must own (or a preset exercise). */
const PARENTS: Record<SyncTable, { column: string; table: SyncTable }[]> = {
  exercises: [],
  templates: [],
  templateExercises: [
    { column: 'templateId', table: 'templates' },
    { column: 'exerciseId', table: 'exercises' },
  ],
  templateSets: [{ column: 'templateExerciseId', table: 'templateExercises' }],
  sessions: [{ column: 'templateId', table: 'templates' }],
  sessionExercises: [
    { column: 'sessionId', table: 'sessions' },
    { column: 'exerciseId', table: 'exercises' },
  ],
  sets: [{ column: 'sessionExerciseId', table: 'sessionExercises' }],
  userSettings: [],
}

const TIMESTAMP_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'startedAt',
  'finishedAt',
  'completedAt',
])

type Known = { userId: string | null; updatedAt: Date }
type Candidate = { index: number; change: SyncChange; rejected?: string }

export type PushOutcome = {
  results: MutationResult[]
  sessionIds: string[]
  exerciseIds: string[]
}

/** Push a batch, then run side effects for the sessions/exercises it touched. */
export async function pushChanges(
  db: Db,
  userId: string,
  mutations: RawMutation[],
  now = new Date(),
): Promise<MutationResult[]> {
  const outcome = await applyPush(db, userId, mutations, now)
  if (outcome.sessionIds.length > 0 || outcome.exerciseIds.length > 0) {
    try {
      await onSessionsChanged(db, userId, outcome.sessionIds, outcome.exerciseIds)
    } catch (error) {
      // The push itself is committed; side effects are recomputable later.
      console.error('sync side effects failed', error)
    }
  }
  return outcome.results
}

export async function applyPush(
  db: Db,
  userId: string,
  mutations: RawMutation[],
  now: Date,
): Promise<PushOutcome> {
  const results: MutationResult[] = []
  const candidates: Candidate[] = []

  mutations.forEach((m, index) => {
    const id = typeof m.row.id === 'string' ? m.row.id : ''
    // userId always comes from the session, never from the client.
    const parsed = syncRowSchemas[m.table].safeParse({ ...m.row, userId })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const where = issue?.path.length ? `${issue.path.join('.')}: ` : ''
      results[index] = rejected(m.table, id, `invalid: ${where}${issue?.message ?? 'bad row'}`)
      return
    }
    // The schema lookup and the table can't be correlated by TS; they match by construction.
    const change = { table: m.table, row: parsed.data } as SyncChange
    if (change.table === 'exercises' && change.row.isPreset) {
      results[index] = rejected(m.table, id, 'preset exercises are read-only')
      return
    }
    candidates.push({ index, change })
  })

  return db.transaction(async (tx) => {
    // Serializes a user's pushes so serverVersions of one user commit in order.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`)

    const known = await fetchKnown(tx, candidates)
    checkOwnership(candidates, known, userId)
    await checkSetCompletion(tx, candidates)

    const maxUpdatedAt = now.getTime() + MAX_CLOCK_SKEW_MS
    const applied: SyncChange[] = []
    for (const c of candidates) {
      const { table, row } = c.change
      if (c.rejected) {
        results[c.index] = rejected(table, row.id, c.rejected)
        continue
      }
      const updatedAt = new Date(Math.min(Date.parse(row.updatedAt), maxUpdatedAt))
      const existing = known[table].get(row.id)
      if (existing && existing.updatedAt.getTime() > updatedAt.getTime()) {
        results[c.index] = { table, id: row.id, status: 'ignored_stale' }
        continue
      }
      await upsert(tx, table, { ...toDbValues(row), updatedAt })
      known[table].set(row.id, { userId, updatedAt })
      applied.push(c.change)
      results[c.index] = { table, id: row.id, status: 'applied' }
    }

    const touched = await cascadeTombstones(tx, userId, applied)
    return { results, ...touched }
  })
}

function rejected(table: SyncTable, id: string, error: string): MutationResult {
  return { table, id, status: 'rejected', error }
}

function parentIds(change: SyncChange): { table: SyncTable; id: string }[] {
  const row: Record<string, unknown> = change.row
  return PARENTS[change.table].flatMap(({ column, table }) => {
    const id = row[column]
    return typeof id === 'string' ? [{ table, id }] : []
  })
}

/** Owner and updatedAt of every row the batch writes or references, by table. */
async function fetchKnown(tx: Tx, candidates: Candidate[]) {
  const wanted = Object.fromEntries(SYNC_TABLES.map((t) => [t, new Set<string>()])) as Record<
    SyncTable,
    Set<string>
  >
  for (const c of candidates) {
    wanted[c.change.table].add(c.change.row.id)
    for (const p of parentIds(c.change)) wanted[p.table].add(p.id)
  }
  const known = Object.fromEntries(SYNC_TABLES.map((t) => [t, new Map<string, Known>()])) as Record<
    SyncTable,
    Map<string, Known>
  >
  for (const table of SYNC_TABLES) {
    const ids = [...wanted[table]]
    if (ids.length === 0) continue
    const t = syncedTables[table]
    const rows = await tx
      .select({ id: t.id, userId: t.userId, updatedAt: t.updatedAt })
      .from(t)
      .where(inArray(t.id, ids))
    for (const r of rows) known[table].set(r.id, { userId: r.userId, updatedAt: r.updatedAt })
  }
  return known
}

/**
 * Rejects rows owned by someone else, and rows whose parent is neither the user's
 * (in the DB or accepted in this batch) nor a preset exercise. Repeats until stable,
 * since rejecting a parent in the batch orphans its children in the batch.
 */
function checkOwnership(
  candidates: Candidate[],
  known: Record<SyncTable, Map<string, Known>>,
  userId: string,
) {
  for (const c of candidates) {
    const existing = known[c.change.table].get(c.change.row.id)
    if (existing && existing.userId !== userId) c.rejected = 'row belongs to another user'
  }
  let changed = true
  while (changed) {
    changed = false
    const inBatch = new Set(
      candidates.filter((c) => !c.rejected).map((c) => `${c.change.table}:${c.change.row.id}`),
    )
    for (const c of candidates) {
      if (c.rejected) continue
      for (const p of parentIds(c.change)) {
        if (inBatch.has(`${p.table}:${p.id}`)) continue
        const owner = known[p.table].get(p.id)
        // Presets are the only rows with a null owner.
        if (owner && (owner.userId === userId || owner.userId === null)) continue
        c.rejected = `unknown parent ${p.table} ${p.id}`
        changed = true
        break
      }
    }
  }
}

/** Completed sets need the actuals their exercise type requires. */
async function checkSetCompletion(tx: Tx, candidates: Candidate[]) {
  const live = candidates.filter((c) => !c.rejected)
  const batchSessionExercises = new Map<string, string>()
  const batchExerciseTypes = new Map<string, ExerciseType>()
  for (const { change } of live) {
    if (change.table === 'sessionExercises')
      batchSessionExercises.set(change.row.id, change.row.exerciseId)
    if (change.table === 'exercises') batchExerciseTypes.set(change.row.id, change.row.type)
  }
  const completed = live.filter(
    (c): c is Candidate & { change: Extract<SyncChange, { table: 'sets' }> } =>
      c.change.table === 'sets' && c.change.row.completedAt !== null,
  )
  if (completed.length === 0) return

  const missingSe = completed
    .map((c) => c.change.row.sessionExerciseId)
    .filter((id) => !batchSessionExercises.has(id))
  if (missingSe.length > 0) {
    const rows = await tx
      .select({ id: sessionExercises.id, exerciseId: sessionExercises.exerciseId })
      .from(sessionExercises)
      .where(inArray(sessionExercises.id, missingSe))
    for (const r of rows) batchSessionExercises.set(r.id, r.exerciseId)
  }
  const missingEx = [...new Set(batchSessionExercises.values())].filter(
    (id) => !batchExerciseTypes.has(id),
  )
  if (missingEx.length > 0) {
    const rows = await tx
      .select({ id: exercises.id, type: exercises.type })
      .from(exercises)
      .where(inArray(exercises.id, missingEx))
    for (const r of rows) batchExerciseTypes.set(r.id, r.type)
  }

  for (const c of completed) {
    const exerciseId = batchSessionExercises.get(c.change.row.sessionExerciseId)
    const type = exerciseId ? batchExerciseTypes.get(exerciseId) : undefined
    // An unknown parent is already rejected by the ownership check.
    if (!type) continue
    const error = setCompletionError(c.change.row, type)
    if (error) c.rejected = `invalid: ${error}`
  }
}

function toDbValues(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      TIMESTAMP_COLUMNS.has(key) && typeof value === 'string' ? new Date(value) : value,
    ]),
  )
}

// Values were validated against the table's Zod schema and converted to DB types;
// TS can't correlate table and row through the union, so each branch names its table.
async function upsert(tx: Tx, table: SyncTable, values: Record<string, unknown>) {
  switch (table) {
    case 'exercises': {
      const v = values as typeof exercises.$inferInsert
      return tx.insert(exercises).values(v).onConflictDoUpdate({ target: exercises.id, set: v })
    }
    case 'templates': {
      const v = values as typeof templates.$inferInsert
      return tx.insert(templates).values(v).onConflictDoUpdate({ target: templates.id, set: v })
    }
    case 'templateExercises': {
      const v = values as typeof templateExercises.$inferInsert
      return tx
        .insert(templateExercises)
        .values(v)
        .onConflictDoUpdate({ target: templateExercises.id, set: v })
    }
    case 'templateSets': {
      const v = values as typeof templateSets.$inferInsert
      return tx
        .insert(templateSets)
        .values(v)
        .onConflictDoUpdate({ target: templateSets.id, set: v })
    }
    case 'sessions': {
      const v = values as typeof sessions.$inferInsert
      return tx.insert(sessions).values(v).onConflictDoUpdate({ target: sessions.id, set: v })
    }
    case 'sessionExercises': {
      const v = values as typeof sessionExercises.$inferInsert
      return tx
        .insert(sessionExercises)
        .values(v)
        .onConflictDoUpdate({ target: sessionExercises.id, set: v })
    }
    case 'sets': {
      const v = values as typeof sets.$inferInsert
      return tx.insert(sets).values(v).onConflictDoUpdate({ target: sets.id, set: v })
    }
    case 'userSettings': {
      const v = values as typeof userSettings.$inferInsert
      return tx
        .insert(userSettings)
        .values(v)
        .onConflictDoUpdate({ target: userSettings.id, set: v })
    }
  }
}

/**
 * Tombstone children of tombstoned parents among the touched rows: sessions →
 * session_exercises → sets, templates → template_exercises → template_sets
 * (DATA_MODEL_AND_SYNC.md §8). The child's updatedAt becomes at least the parent's
 * so clients holding the child apply the tombstone under LWW.
 */
async function cascadeTombstones(tx: Tx, userId: string, applied: SyncChange[]) {
  const ids = (table: SyncTable) => applied.filter((c) => c.table === table).map((c) => c.row.id)
  const parentsOf = (table: 'sets' | 'templateSets') =>
    applied.flatMap((c) => {
      if (table === 'sets' && c.table === 'sets') return [c.row.sessionExerciseId]
      if (table === 'templateSets' && c.table === 'templateSets') return [c.row.templateExerciseId]
      return []
    })

  // Sessions
  const seKeys = [...ids('sessionExercises'), ...parentsOf('sets')]
  const appliedSessions = ids('sessions')
  const seRows = await selectChildren(
    tx,
    sessionExercises,
    sessionExercises.sessionId,
    seKeys,
    appliedSessions,
  )
  const touchedSessions = unique([...appliedSessions, ...seRows.map((r) => r.parentId)])
  if (touchedSessions.length > 0) {
    await tx
      .update(sessionExercises)
      .set({
        deletedAt: sql`${sessions.deletedAt}`,
        updatedAt: sql`GREATEST(${sessionExercises.updatedAt}, ${sessions.updatedAt})`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessionExercises.sessionId, sessions.id),
          eq(sessions.userId, userId),
          inArray(sessions.id, touchedSessions),
          isNotNull(sessions.deletedAt),
          isNull(sessionExercises.deletedAt),
        ),
      )
  }
  const touchedSe = unique([...seKeys, ...seRows.map((r) => r.id)])
  if (touchedSe.length > 0) {
    await tx
      .update(sets)
      .set({
        deletedAt: sql`${sessionExercises.deletedAt}`,
        updatedAt: sql`GREATEST(${sets.updatedAt}, ${sessionExercises.updatedAt})`,
      })
      .from(sessionExercises)
      .where(
        and(
          eq(sets.sessionExerciseId, sessionExercises.id),
          eq(sessionExercises.userId, userId),
          inArray(sessionExercises.id, touchedSe),
          isNotNull(sessionExercises.deletedAt),
          isNull(sets.deletedAt),
        ),
      )
  }

  // Templates
  const teKeys = [...ids('templateExercises'), ...parentsOf('templateSets')]
  const appliedTemplates = ids('templates')
  const teRows = await selectChildren(
    tx,
    templateExercises,
    templateExercises.templateId,
    teKeys,
    appliedTemplates,
  )
  const touchedTemplates = unique([...appliedTemplates, ...teRows.map((r) => r.parentId)])
  if (touchedTemplates.length > 0) {
    await tx
      .update(templateExercises)
      .set({
        deletedAt: sql`${templates.deletedAt}`,
        updatedAt: sql`GREATEST(${templateExercises.updatedAt}, ${templates.updatedAt})`,
      })
      .from(templates)
      .where(
        and(
          eq(templateExercises.templateId, templates.id),
          eq(templates.userId, userId),
          inArray(templates.id, touchedTemplates),
          isNotNull(templates.deletedAt),
          isNull(templateExercises.deletedAt),
        ),
      )
  }
  const touchedTe = unique([...teKeys, ...teRows.map((r) => r.id)])
  if (touchedTe.length > 0) {
    await tx
      .update(templateSets)
      .set({
        deletedAt: sql`${templateExercises.deletedAt}`,
        updatedAt: sql`GREATEST(${templateSets.updatedAt}, ${templateExercises.updatedAt})`,
      })
      .from(templateExercises)
      .where(
        and(
          eq(templateSets.templateExerciseId, templateExercises.id),
          eq(templateExercises.userId, userId),
          inArray(templateExercises.id, touchedTe),
          isNotNull(templateExercises.deletedAt),
          isNull(templateSets.deletedAt),
        ),
      )
  }

  return {
    sessionIds: touchedSessions,
    exerciseIds: unique(seRows.map((r) => r.exerciseId)),
  }
}

/** Child rows by id, plus all children of the given parents. */
async function selectChildren(
  tx: Tx,
  table: typeof sessionExercises | typeof templateExercises,
  parentColumn: typeof sessionExercises.sessionId | typeof templateExercises.templateId,
  childIds: string[],
  parentIdList: string[],
) {
  const filters = [
    childIds.length > 0 ? inArray(table.id, childIds) : undefined,
    parentIdList.length > 0 ? inArray(parentColumn, parentIdList) : undefined,
  ].filter((f) => f !== undefined)
  if (filters.length === 0) return []
  return tx
    .select({ id: table.id, parentId: parentColumn, exerciseId: table.exerciseId })
    .from(table)
    .where(or(...filters))
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

/**
 * Own rows and preset exercises with serverVersion > cursor, ordered. All tables are
 * read in one REPEATABLE READ snapshot so a push committing mid-pull can't make the
 * cursor skip rows. (In-flight pushes of this user hold the advisory lock, and every
 * row of a user's stream is written under it, so nothing above the cursor commits
 * later with a lower version.)
 */
export async function pullChanges(
  db: Db,
  userId: string,
  cursor: string,
  limit: number,
): Promise<PullResponse> {
  const after = Number(cursor)
  const fetched = await db.transaction(
    async (tx) => {
      const all: { version: number; table: SyncTable; row: Record<string, unknown> }[] = []
      for (const table of SYNC_TABLES) {
        const t = syncedTables[table]
        const owner =
          table === 'exercises'
            ? or(eq(exercises.userId, userId), eq(exercises.isPreset, true))
            : eq(t.userId, userId)
        const rows: Record<string, unknown>[] = await tx
          .select(getTableColumns(t))
          .from(t)
          .where(and(gt(t.serverVersion, after), owner))
          .orderBy(t.serverVersion)
          .limit(limit + 1)
        for (const { serverVersion, ...row } of rows) {
          all.push({ version: Number(serverVersion), table, row })
        }
      }
      return all
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
  fetched.sort((a, b) => a.version - b.version)
  const page = fetched.slice(0, limit)
  const last = page.at(-1)
  return {
    changes: page.map(({ table, row }) => ({ table, row })),
    cursor: last ? String(last.version) : cursor,
    hasMore: fetched.length > limit,
  }
}
