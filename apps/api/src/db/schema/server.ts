import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { timestamptz } from './columns'
import { friendshipStatusEnum, prTypeEnum, reactionEmojiEnum } from './enums'
import { exercises, sessions, sets } from './synced'

// Server-only tables, not in the sync stream (DATA_MODEL_AND_SYNC.md §3).

const userRef = () =>
  uuid()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })

export const friendships = pgTable(
  'friendships',
  {
    id: uuid().primaryKey().defaultRandom(),
    requesterId: userRef(),
    addresseeId: userRef(),
    status: friendshipStatusEnum().notNull().default('pending'),
    createdAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    // Unique on the unordered pair.
    uniqueIndex('friendships_pair_unique').on(
      sql`LEAST(${t.requesterId}, ${t.addresseeId})`,
      sql`GREATEST(${t.requesterId}, ${t.addresseeId})`,
    ),
    index().on(t.addresseeId),
  ],
)

export const friendMutes = pgTable(
  'friend_mutes',
  {
    userId: userRef(),
    mutedUserId: userRef(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mutedUserId] })],
)

export const reactions = pgTable(
  'reactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id),
    emoji: reactionEmojiEnum().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.userId, t.sessionId), index().on(t.sessionId)],
)

export const feedEvents = pgTable(
  'feed_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    sessionId: uuid()
      .notNull()
      .unique()
      .references(() => sessions.id),
    // = session finishedAt
    createdAt: timestamptz().notNull(),
    prs: jsonb().notNull().default([]),
    hidden: boolean().notNull().default(false),
  },
  (t) => [index().on(t.userId, t.createdAt)],
)

export const personalRecords = pgTable(
  'personal_records',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id),
    prType: prTypeEnum().notNull(),
    value: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull(),
    setId: uuid().references(() => sets.id),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id),
    achievedAt: timestamptz().notNull(),
  },
  (t) => [index().on(t.userId, t.exerciseId), index().on(t.sessionId)],
)

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: timestamptz().notNull().defaultNow(),
    lastUsedAt: timestamptz(),
  },
  (t) => [index().on(t.userId)],
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    type: text().notNull(),
    payload: jsonb().notNull().default({}),
    readAt: timestamptz(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
)

export const scheduledPushes = pgTable(
  'scheduled_pushes',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: userRef(),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id),
    fireAt: timestamptz().notNull(),
    sentAt: timestamptz(),
    cancelledAt: timestamptz(),
  },
  (t) => [
    index('scheduled_pushes_pending')
      .on(t.fireAt)
      .where(sql`"sentAt" IS NULL AND "cancelledAt" IS NULL`),
  ],
)
