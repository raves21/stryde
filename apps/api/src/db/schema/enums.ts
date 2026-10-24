import {
  EQUIPMENT,
  EXERCISE_TYPES,
  FRIENDSHIP_STATUSES,
  MUSCLE_GROUPS,
  PR_TYPES,
  REACTION_EMOJIS,
  SET_TYPES,
  TARGET_KINDS,
  WEIGHT_UNITS,
} from '@stryde/shared'
import { pgEnum } from 'drizzle-orm/pg-core'

export const exerciseTypeEnum = pgEnum('exercise_type', EXERCISE_TYPES)
export const muscleGroupEnum = pgEnum('muscle_group', MUSCLE_GROUPS)
export const equipmentEnum = pgEnum('equipment', EQUIPMENT)
export const setTypeEnum = pgEnum('set_type', SET_TYPES)
export const targetKindEnum = pgEnum('target_kind', TARGET_KINDS)
export const weightUnitEnum = pgEnum('weight_unit', WEIGHT_UNITS)
export const friendshipStatusEnum = pgEnum('friendship_status', FRIENDSHIP_STATUSES)
export const reactionEmojiEnum = pgEnum('reaction_emoji', REACTION_EMOJIS)
export const prTypeEnum = pgEnum('pr_type', PR_TYPES)
