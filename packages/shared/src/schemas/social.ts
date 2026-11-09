import { z } from 'zod'
import {
  type ExerciseType,
  type PrType,
  REACTION_EMOJIS,
  type ReactionEmoji,
  type SetType,
  type TargetKind,
} from '../constants'

// Social API payloads (DATA_MODEL_AND_SYNC.md §7, plan/phase-08). Online-only: never in
// Dexie, never in the outbox. Requests are Zod schemas; responses are plain types.

export const sendFriendRequestSchema = z.object({
  username: z.string().trim().min(1).max(40),
})
export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>

export const reactionBodySchema = z.object({ emoji: z.enum(REACTION_EMOJIS) })

export const FEED_PAGE_SIZE = 20

export const feedQuerySchema = z.object({
  /** Opaque cursor from the previous page's `nextCursor`. */
  before: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(FEED_PAGE_SIZE),
})

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(40),
})

/** What other users may see of someone (search shows only name, username and avatar). */
export type PublicProfile = {
  username: string
  displayName: string
  avatarUrl: string | null
}

export type Relation = 'none' | 'friend' | 'outgoing' | 'incoming'

export type UserSearchResult = PublicProfile & { relation: Relation }

export type Friend = PublicProfile & {
  userId: string
  /** `finishedAt` of their latest shared workout, if any. */
  lastWorkoutAt: string | null
  /** I muted their notifications. */
  muted: boolean
}

export type FriendRequest = {
  id: string
  user: PublicProfile & { userId: string }
  createdAt: string
}

export type FriendRequests = {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/** A personal record achieved in one session, as stored on its feed event. */
export type FeedPR = {
  exerciseId: string
  exerciseName: string
  prType: PrType
  /** kg / reps / seconds, as in `DetectedPR`. */
  value: number
  previous: number
  weightKg?: number
}

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>

export type FeedItem = {
  /** Feed event id. */
  id: string
  sessionId: string
  actor: PublicProfile & { userId: string; isMe: boolean }
  name: string
  startedAt: string
  finishedAt: string
  durationSec: number
  exerciseCount: number
  setCount: number
  /** A sport session (time only): the card shows no exercise or set counts. */
  sport: boolean
  prs: FeedPR[]
  reactions: ReactionCounts
  myReaction: ReactionEmoji | null
}

export type FeedPage = { items: FeedItem[]; nextCursor: string | null }

export type Reactor = PublicProfile & { userId: string; emoji: ReactionEmoji; createdAt: string }

export type SessionDetailSet = {
  id: string
  position: number
  setType: SetType
  targetKind: TargetKind
  weightKg: number | null
  reps: number | null
  rir: number | null
  durationSec: number | null
}

export type SessionDetailExercise = {
  id: string
  exerciseId: string
  name: string
  type: ExerciseType
  position: number
  supersetGroup: string | null
  /** Completed sets only. */
  sets: SessionDetailSet[]
}

/** A finished, visible session as the API returns it to its owner or a friend. */
export type SessionDetail = {
  id: string
  owner: PublicProfile & { userId: string; isMe: boolean }
  name: string
  startedAt: string
  finishedAt: string
  notes: string | null
  prs: FeedPR[]
  exercises: SessionDetailExercise[]
  reactions: ReactionCounts
  myReaction: ReactionEmoji | null
}
