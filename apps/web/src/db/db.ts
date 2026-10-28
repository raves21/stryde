import type {
  ExerciseRow,
  SessionExerciseRow,
  SessionRow,
  SetRow,
  SyncChange,
  SyncRowMap,
  SyncTable,
  TemplateExerciseRow,
  TemplateRow,
  TemplateSetRow,
  UserSettingsRow,
} from '@stryde/shared'
import Dexie, { type EntityTable, type Table } from 'dexie'

export type MetaRow = { key: string; value: unknown }

/** A pending local change: the latest full snapshot of one row (coalesced per row). */
export type OutboxEntry = SyncChange & { seq: number; rowId: string; queuedAt: string }

/** A mutation the server rejected; kept for Settings → Sync instead of being retried. */
export type SyncErrorEntry = SyncChange & { id: number; rowId: string; error: string; at: string }

/**
 * Local database (DATA_MODEL_AND_SYNC.md §4). Synced stores hold rows exactly as the
 * shared Zod schemas describe them; never write them outside `repositories/` or the
 * sync engine. `null` isn't a valid IndexedDB key, so rows with a null `deletedAt` or
 * `finishedAt` are absent from those indexes; filter in JS instead.
 */
export class StrydeDb extends Dexie {
  exercises!: EntityTable<ExerciseRow, 'id'>
  templates!: EntityTable<TemplateRow, 'id'>
  templateExercises!: EntityTable<TemplateExerciseRow, 'id'>
  templateSets!: EntityTable<TemplateSetRow, 'id'>
  sessions!: EntityTable<SessionRow, 'id'>
  sessionExercises!: EntityTable<SessionExerciseRow, 'id'>
  sets!: EntityTable<SetRow, 'id'>
  userSettings!: EntityTable<UserSettingsRow, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  syncErrors!: EntityTable<SyncErrorEntry, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'stryde') {
    super(name)
    this.version(1).stores({
      meta: 'key',
    })
    this.version(2).stores({
      exercises: 'id, userId, name, muscleGroup, deletedAt',
      templates: 'id, sortOrder, deletedAt',
      templateExercises: 'id, templateId, [templateId+position]',
      templateSets: 'id, templateExerciseId, [templateExerciseId+position]',
      sessions: 'id, localDate, startedAt, finishedAt, deletedAt',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+position]',
      sets: 'id, sessionExerciseId, [sessionExerciseId+position], completedAt',
      userSettings: 'id',
      outbox: '++seq, table, rowId, &[table+rowId]',
      syncErrors: '++id',
    })
  }

  /** The store of a synced table, typed by table name. */
  syncTable<T extends SyncTable>(table: T): Table<SyncRowMap[T], string> {
    return this.table(table)
  }
}

export const db = new StrydeDb()
