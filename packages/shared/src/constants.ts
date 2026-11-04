// Enums and limits shared by web and api (DATA_MODEL_AND_SYNC.md §2–3).
// Drizzle pgEnums and Zod schemas are built from these arrays.

export const WEIGHT_UNITS = ['kg', 'lb'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

export const EXERCISE_TYPES = ['weighted', 'bodyweight', 'timed'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
  'cardio',
  'other',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const SET_TYPES = ['warmup', 'working'] as const
export type SetType = (typeof SET_TYPES)[number]

export const TARGET_KINDS = ['fixed', 'rir', 'failure'] as const
export type TargetKind = (typeof TARGET_KINDS)[number]

export const FRIENDSHIP_STATUSES = ['pending', 'accepted', 'declined'] as const
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number]

export const REACTION_EMOJIS = ['muscle', 'fire', 'clap', 'trophy', 'grimace'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export const REACTION_EMOJI_MAP: Record<ReactionEmoji, string> = {
  muscle: '💪',
  fire: '🔥',
  clap: '👏',
  trophy: '🏆',
  grimace: '😤',
}

export const PR_TYPES = [
  'e1rm',
  'weight',
  'reps_at_weight',
  'volume',
  'max_reps',
  'duration',
] as const
export type PrType = (typeof PR_TYPES)[number]

/** Lowercase, 3–20 chars, a-z 0-9 _ (PRODUCT_SPEC.md §3). */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const PASSWORD_MIN_LENGTH = 8

export const DEFAULT_REST_SECONDS = 120

export const NOTIFICATION_TYPES = [
  'friend_workout_finished',
  'reaction_received',
  'friend_request',
  'friend_accepted',
  'rest_timer_done',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** The `user_settings` switch that gates each notification type (PRODUCT_SPEC.md §4.7). */
export const NOTIFICATION_SETTING_KEYS = {
  friend_workout_finished: 'notifyFriendWorkouts',
  reaction_received: 'notifyReactions',
  friend_request: 'notifyFriendRequests',
  friend_accepted: 'notifyFriendRequests',
  rest_timer_done: 'notifyRestTimer',
} as const satisfies Record<NotificationType, string>

/** Types caused by a friend's activity; a muted friend doesn't trigger them. */
export const FRIEND_MUTABLE_NOTIFICATIONS: readonly NotificationType[] = [
  'friend_workout_finished',
  'reaction_received',
]

/** A workout finished this recently notifies friends; a late sync doesn't. */
export const NOTIFY_WINDOW_MS = 60 * 60 * 1000
