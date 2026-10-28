import { sql } from 'drizzle-orm'
import { boolean, date, index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { syncedColumns, timestamptz } from './columns'
import {
  equipmentEnum,
  exerciseTypeEnum,
  muscleGroupEnum,
  setTypeEnum,
  targetKindEnum,
  weightUnitEnum,
} from './enums'

// User-owned synced tables (DATA_MODEL_AND_SYNC.md §2). Every table gets an
// (userId, serverVersion) index for pull.

const kg = () => numeric({ precision: 7, scale: 2, mode: 'number' })

export const exercises = pgTable(
  'exercises',
  {
    ...syncedColumns,
    // Presets have userId = null.
    userId: uuid(),
    name: text().notNull(),
    type: exerciseTypeEnum().notNull(),
    muscleGroup: muscleGroupEnum().notNull(),
    equipment: equipmentEnum().notNull(),
    defaultRestSeconds: integer(),
    isPreset: boolean().notNull().default(false),
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.isPreset, t.serverVersion)],
)

export const templates = pgTable(
  'templates',
  {
    ...syncedColumns,
    name: text().notNull(),
    notes: text(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index().on(t.userId, t.serverVersion)],
)

export const templateExercises = pgTable(
  'template_exercises',
  {
    ...syncedColumns,
    templateId: uuid().notNull(),
    exerciseId: uuid().notNull(),
    position: integer().notNull(),
    supersetGroup: text(),
    restSeconds: integer(),
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.templateId)],
)

export const templateSets = pgTable(
  'template_sets',
  {
    ...syncedColumns,
    templateExerciseId: uuid().notNull(),
    position: integer().notNull(),
    setType: setTypeEnum().notNull(),
    targetKind: targetKindEnum().notNull(),
    targetReps: integer(),
    targetRepsMax: integer(),
    targetRir: integer(),
    plannedWeightKg: kg(),
    plannedDurationSec: integer(),
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.templateExerciseId)],
)

export const sessions = pgTable(
  'sessions',
  {
    ...syncedColumns,
    templateId: uuid(),
    name: text().notNull(),
    startedAt: timestamptz().notNull(),
    finishedAt: timestamptz(),
    timezone: text().notNull(),
    localDate: date({ mode: 'string' }).notNull(),
    notes: text(),
    shareWithFriends: boolean().notNull().default(true),
  },
  (t) => [
    index().on(t.userId, t.serverVersion),
    index().on(t.userId, t.localDate),
    // Deliberately not unique: two devices can each start a workout offline, and both
    // must sync so the client can ask which to keep (DATA_MODEL_AND_SYNC.md §8).
    index('sessions_active_per_user')
      .on(t.userId)
      .where(sql`"finishedAt" IS NULL AND "deletedAt" IS NULL`),
  ],
)

export const sessionExercises = pgTable(
  'session_exercises',
  {
    ...syncedColumns,
    sessionId: uuid().notNull(),
    exerciseId: uuid().notNull(),
    position: integer().notNull(),
    supersetGroup: text(),
    restSeconds: integer(),
  },
  (t) => [
    index().on(t.userId, t.serverVersion),
    index().on(t.sessionId),
    index().on(t.userId, t.exerciseId),
  ],
)

export const sets = pgTable(
  'sets',
  {
    ...syncedColumns,
    sessionExerciseId: uuid().notNull(),
    position: integer().notNull(),
    setType: setTypeEnum().notNull(),
    targetKind: targetKindEnum().notNull(),
    targetReps: integer(),
    targetRepsMax: integer(),
    targetRir: integer(),
    weightKg: kg(),
    reps: integer(),
    rir: integer(),
    durationSec: integer(),
    completedAt: timestamptz(),
  },
  (t) => [index().on(t.userId, t.serverVersion), index().on(t.sessionExerciseId)],
)

// One row per user, id = userId.
export const userSettings = pgTable(
  'user_settings',
  {
    ...syncedColumns,
    unit: weightUnitEnum().notNull().default('kg'),
    defaultRestSeconds: integer().notNull().default(120),
    defaultShareWithFriends: boolean().notNull().default(true),
    notificationsMuted: boolean().notNull().default(false),
    notifyFriendWorkouts: boolean().notNull().default(true),
    notifyReactions: boolean().notNull().default(true),
    notifyFriendRequests: boolean().notNull().default(true),
    notifyRestTimer: boolean().notNull().default(true),
  },
  (t) => [index().on(t.userId, t.serverVersion)],
)

/** Tables in the sync stream, keyed by the name used in sync payloads. */
export const syncedTables = {
  exercises,
  templates,
  templateExercises,
  templateSets,
  sessions,
  sessionExercises,
  sets,
  userSettings,
} as const
