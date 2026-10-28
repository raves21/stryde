import { z } from 'zod'
import {
  type ExerciseRow,
  exerciseRowSchema,
  type SessionExerciseRow,
  type SessionRow,
  type SetRow,
  sessionExerciseRowSchema,
  sessionRowSchema,
  setRowSchema,
  type TemplateExerciseRow,
  type TemplateRow,
  type TemplateSetRow,
  templateExerciseRowSchema,
  templateRowSchema,
  templateSetRowSchema,
  type UserSettingsRow,
  userSettingsRowSchema,
} from './rows'

// Sync API payloads (DATA_MODEL_AND_SYNC.md §5).

/**
 * Synced tables by their payload name (= Dexie store name). Listed parents first:
 * the client pushes in this order so a parent never lands in a later batch than
 * its children.
 */
export const SYNC_TABLES = [
  'exercises',
  'templates',
  'templateExercises',
  'templateSets',
  'sessions',
  'sessionExercises',
  'sets',
  'userSettings',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export const syncRowSchemas = {
  exercises: exerciseRowSchema,
  templates: templateRowSchema,
  templateExercises: templateExerciseRowSchema,
  templateSets: templateSetRowSchema,
  sessions: sessionRowSchema,
  sessionExercises: sessionExerciseRowSchema,
  sets: setRowSchema,
  userSettings: userSettingsRowSchema,
} as const satisfies Record<SyncTable, z.ZodType>

export type SyncRowMap = {
  exercises: ExerciseRow
  templates: TemplateRow
  templateExercises: TemplateExerciseRow
  templateSets: TemplateSetRow
  sessions: SessionRow
  sessionExercises: SessionExerciseRow
  sets: SetRow
  userSettings: UserSettingsRow
}
export type SyncRow = SyncRowMap[SyncTable]

/** A typed mutation / change: `{ table, row }` with the row type matching the table. */
export type SyncChange = { [T in SyncTable]: { table: T; row: SyncRowMap[T] } }[SyncTable]

export const PUSH_BATCH_SIZE = 200
export const PULL_LIMIT_MAX = 1000

/**
 * The envelope only; each row is validated against its table schema on the server
 * so one bad row is `rejected` without failing the whole batch.
 */
export const pushRequestSchema = z.object({
  clientId: z.uuid(),
  mutations: z
    .array(z.object({ table: z.enum(SYNC_TABLES), row: z.record(z.string(), z.unknown()) }))
    .max(PUSH_BATCH_SIZE),
})
export type PushRequest = { clientId: string; mutations: SyncChange[] }

export const MUTATION_STATUSES = ['applied', 'ignored_stale', 'rejected'] as const
export type MutationStatus = (typeof MUTATION_STATUSES)[number]

export const pushResponseSchema = z.object({
  results: z.array(
    z.object({
      table: z.enum(SYNC_TABLES),
      id: z.string(),
      status: z.enum(MUTATION_STATUSES),
      error: z.string().optional(),
    }),
  ),
})
export type PushResponse = z.infer<typeof pushResponseSchema>
export type MutationResult = PushResponse['results'][number]

export const pullQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d{1,19}$/)
    .default('0'),
  limit: z.coerce.number().int().min(1).max(PULL_LIMIT_MAX).default(PULL_LIMIT_MAX),
})

/** Rows stay unvalidated in the envelope; the client parses each with its table schema. */
export const pullResponseSchema = z.object({
  changes: z.array(
    z.object({ table: z.enum(SYNC_TABLES), row: z.record(z.string(), z.unknown()) }),
  ),
  cursor: z.string().regex(/^\d+$/),
  hasMore: z.boolean(),
})
export type PullResponse = z.infer<typeof pullResponseSchema>
