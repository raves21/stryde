import { z } from 'zod'
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  type ExerciseType,
  MUSCLE_GROUPS,
  SET_TYPES,
  TARGET_KINDS,
  WEIGHT_UNITS,
} from '../constants'

// Row shapes of the synced tables (DATA_MODEL_AND_SYNC.md §2), as stored in Dexie and
// sent over the sync API. `serverVersion` is server-only and never part of a row.

const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const name = z.string().trim().min(1).max(100)
const notes = z.string().max(2000).nullable()
const position = z.number().int().min(0).max(10_000)
const restSeconds = z.number().int().min(0).max(3600)
const reps = z.number().int().min(0).max(1000)
const rir = z.number().int().min(0).max(10)
const durationSec = z.number().int().min(0).max(86_400)
// numeric(7,2); bodyweight exercises store *added* weight, so never negative.
const weightKg = z.number().min(0).max(10_000)
const supersetGroup = z.string().min(1).max(8).nullable()

const synced = {
  id,
  userId: id,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
}

function repRange(row: { targetReps: number | null; targetRepsMax: number | null }) {
  return (
    row.targetReps === null || row.targetRepsMax === null || row.targetRepsMax >= row.targetReps
  )
}
const repRangeError = { message: 'targetRepsMax must be >= targetReps', path: ['targetRepsMax'] }

export const exerciseRowSchema = z.object({
  ...synced,
  // Presets have userId = null.
  userId: id.nullable(),
  name,
  type: z.enum(EXERCISE_TYPES),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  defaultRestSeconds: restSeconds.nullable(),
  isPreset: z.boolean(),
})

export const templateRowSchema = z.object({
  ...synced,
  name,
  notes,
  sortOrder: z.number().int().min(-1_000_000).max(1_000_000),
})

export const templateExerciseRowSchema = z.object({
  ...synced,
  templateId: id,
  exerciseId: id,
  position,
  supersetGroup,
  restSeconds: restSeconds.nullable(),
})

export const templateSetRowSchema = z
  .object({
    ...synced,
    templateExerciseId: id,
    position,
    setType: z.enum(SET_TYPES),
    targetKind: z.enum(TARGET_KINDS),
    targetReps: reps.nullable(),
    targetRepsMax: reps.nullable(),
    targetRir: rir.nullable(),
    plannedWeightKg: weightKg.nullable(),
    plannedDurationSec: durationSec.nullable(),
  })
  .refine(repRange, repRangeError)

export const sessionRowSchema = z
  .object({
    ...synced,
    templateId: id.nullable(),
    name,
    startedAt: timestamp,
    finishedAt: timestamp.nullable(),
    timezone: z.string().min(1).max(64),
    localDate: z.iso.date(),
    notes,
    shareWithFriends: z.boolean(),
  })
  .refine((s) => s.finishedAt === null || Date.parse(s.finishedAt) >= Date.parse(s.startedAt), {
    message: 'finishedAt must not be before startedAt',
    path: ['finishedAt'],
  })

export const sessionExerciseRowSchema = z.object({
  ...synced,
  sessionId: id,
  exerciseId: id,
  position,
  supersetGroup,
  restSeconds: restSeconds.nullable(),
})

export const setRowSchema = z
  .object({
    ...synced,
    sessionExerciseId: id,
    position,
    setType: z.enum(SET_TYPES),
    targetKind: z.enum(TARGET_KINDS),
    targetReps: reps.nullable(),
    targetRepsMax: reps.nullable(),
    targetRir: rir.nullable(),
    weightKg: weightKg.nullable(),
    reps: reps.nullable(),
    rir: rir.nullable(),
    durationSec: durationSec.nullable(),
    completedAt: timestamp.nullable(),
  })
  .refine(repRange, repRangeError)
  .superRefine((set, ctx) => {
    // Without the exercise type we can only require *some* actual; see setCompletionError.
    if (set.completedAt === null) return
    if (set.reps === null && set.durationSec === null) {
      ctx.addIssue({ code: 'custom', message: 'A completed set needs reps or a duration' })
    }
    if (set.targetKind === 'rir' && set.rir === null) {
      ctx.addIssue({ code: 'custom', message: 'A completed RIR set needs rir', path: ['rir'] })
    }
  })

export const userSettingsRowSchema = z
  .object({
    ...synced,
    unit: z.enum(WEIGHT_UNITS),
    defaultRestSeconds: restSeconds,
    defaultShareWithFriends: z.boolean(),
    notificationsMuted: z.boolean(),
    notifyFriendWorkouts: z.boolean(),
    notifyReactions: z.boolean(),
    notifyFriendRequests: z.boolean(),
    notifyRestTimer: z.boolean(),
  })
  // One row per user, keyed by the user id.
  .refine((s) => s.id === s.userId, { message: 'id must equal userId', path: ['id'] })

export type ExerciseRow = z.infer<typeof exerciseRowSchema>
export type TemplateRow = z.infer<typeof templateRowSchema>
export type TemplateExerciseRow = z.infer<typeof templateExerciseRowSchema>
export type TemplateSetRow = z.infer<typeof templateSetRowSchema>
export type SessionRow = z.infer<typeof sessionRowSchema>
export type SessionExerciseRow = z.infer<typeof sessionExerciseRowSchema>
export type SetRow = z.infer<typeof setRowSchema>
export type UserSettingsRow = z.infer<typeof userSettingsRowSchema>

/**
 * Exercise-type-aware completion check (DATA_MODEL_AND_SYNC.md §2): a completed set
 * needs `reps` (weighted/bodyweight) or `durationSec` (timed). Returns an error
 * message, or null if the set is fine.
 */
export function setCompletionError(
  set: Pick<SetRow, 'completedAt' | 'reps' | 'durationSec' | 'targetKind' | 'rir'>,
  exerciseType: ExerciseType,
): string | null {
  if (set.completedAt === null) return null
  if (exerciseType === 'timed' && set.durationSec === null) {
    return 'A completed timed set needs a duration'
  }
  if (exerciseType !== 'timed' && set.reps === null) return 'A completed set needs reps'
  if (set.targetKind === 'rir' && set.rir === null) return 'A completed RIR set needs rir'
  return null
}
