import { describe, expect, it } from 'vitest'
import {
  type SetRow,
  sessionRowSchema,
  setCompletionError,
  setRowSchema,
  templateSetRowSchema,
  userSettingsRowSchema,
} from './rows'
import { pullQuerySchema, pushRequestSchema } from './sync'

const ID = '01a16d28-9e70-750e-917d-ccf0c6e2dfd5'
const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'
const NOW = '2026-10-28T10:00:00.000Z'
const base = { id: ID, userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null }

const set: SetRow = {
  ...base,
  sessionExerciseId: ID,
  position: 0,
  setType: 'working',
  targetKind: 'fixed',
  targetReps: 8,
  targetRepsMax: null,
  targetRir: null,
  weightKg: 80,
  reps: null,
  rir: null,
  durationSec: null,
  completedAt: null,
}

describe('setRowSchema', () => {
  it.each<[string, Partial<SetRow>, boolean]>([
    ['planned set', {}, true],
    ['completed with reps', { reps: 8, completedAt: NOW }, true],
    ['completed with duration', { durationSec: 90, completedAt: NOW }, true],
    ['completed without actuals', { completedAt: NOW }, false],
    ['completed rir set without rir', { targetKind: 'rir', reps: 8, completedAt: NOW }, false],
    ['completed rir set with rir', { targetKind: 'rir', reps: 8, rir: 2, completedAt: NOW }, true],
    ['incomplete rir set without rir', { targetKind: 'rir', reps: 8 }, true],
    ['rep range', { targetReps: 8, targetRepsMax: 12 }, true],
    ['inverted rep range', { targetReps: 12, targetRepsMax: 8 }, false],
    ['negative weight', { weightKg: -5 }, false],
    ['fractional reps', { reps: 7.5 }, false],
    ['bad timestamp', { completedAt: 'yesterday', reps: 5 }, false],
  ])('%s → valid=%s', (_, patch, valid) => {
    expect(setRowSchema.safeParse({ ...set, ...patch }).success).toBe(valid)
  })

  it('strips unknown fields such as serverVersion', () => {
    const parsed = setRowSchema.parse({ ...set, serverVersion: 42 })
    expect(parsed).not.toHaveProperty('serverVersion')
  })
})

describe('setCompletionError', () => {
  it.each<[string, Partial<SetRow>, 'weighted' | 'bodyweight' | 'timed', boolean]>([
    ['not completed', {}, 'weighted', true],
    ['weighted with reps', { reps: 5, completedAt: NOW }, 'weighted', true],
    ['weighted with only a duration', { durationSec: 30, completedAt: NOW }, 'weighted', false],
    ['bodyweight with reps', { reps: 12, completedAt: NOW }, 'bodyweight', true],
    ['timed with duration', { durationSec: 90, completedAt: NOW }, 'timed', true],
    ['timed with only reps', { reps: 1, completedAt: NOW }, 'timed', false],
    ['rir set without rir', { targetKind: 'rir', reps: 5, completedAt: NOW }, 'weighted', false],
  ])('%s (%s) → ok=%s', (_, patch, type, ok) => {
    expect(setCompletionError({ ...set, ...patch }, type) === null).toBe(ok)
  })
})

describe('other row refinements', () => {
  it('template sets reject an inverted rep range', () => {
    const row = {
      ...base,
      templateExerciseId: ID,
      position: 0,
      setType: 'working',
      targetKind: 'fixed',
      targetReps: 10,
      targetRepsMax: 6,
      targetRir: null,
      plannedWeightKg: null,
      plannedDurationSec: null,
    }
    expect(templateSetRowSchema.safeParse(row).success).toBe(false)
  })

  it('sessions cannot finish before they start', () => {
    const row = {
      ...base,
      templateId: null,
      name: 'Workout',
      startedAt: NOW,
      finishedAt: '2026-10-28T09:00:00.000Z',
      timezone: 'Asia/Manila',
      localDate: '2026-10-28',
      notes: null,
      shareWithFriends: true,
    }
    expect(sessionRowSchema.safeParse(row).success).toBe(false)
    expect(sessionRowSchema.safeParse({ ...row, finishedAt: null }).success).toBe(true)
  })

  it('user settings are keyed by the user id', () => {
    const row = {
      ...base,
      id: USER,
      unit: 'kg',
      defaultRestSeconds: 120,
      defaultShareWithFriends: true,
      notificationsMuted: false,
      notifyFriendWorkouts: true,
      notifyReactions: true,
      notifyFriendRequests: true,
      notifyRestTimer: true,
    }
    expect(userSettingsRowSchema.safeParse(row).success).toBe(true)
    expect(userSettingsRowSchema.safeParse({ ...row, id: ID }).success).toBe(false)
  })
})

describe('sync payloads', () => {
  it('push accepts at most 200 mutations', () => {
    const mutation = { table: 'sets', row: {} }
    const body = (n: number) => ({ clientId: ID, mutations: Array(n).fill(mutation) })
    expect(pushRequestSchema.safeParse(body(200)).success).toBe(true)
    expect(pushRequestSchema.safeParse(body(201)).success).toBe(false)
  })

  it('push rejects unknown tables', () => {
    const body = { clientId: ID, mutations: [{ table: 'user', row: {} }] }
    expect(pushRequestSchema.safeParse(body).success).toBe(false)
  })

  it.each([
    [{}, { cursor: '0', limit: 1000 }],
    [
      { cursor: '42', limit: '10' },
      { cursor: '42', limit: 10 },
    ],
  ])('pull query %j → %j', (query, expected) => {
    expect(pullQuerySchema.parse(query)).toEqual(expected)
  })

  it.each([{ cursor: '-1' }, { cursor: 'abc' }, { limit: '0' }, { limit: '1001' }])(
    'pull query rejects %j',
    (query) => {
      expect(pullQuerySchema.safeParse(query).success).toBe(false)
    },
  )
})
