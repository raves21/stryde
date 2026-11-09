import type { FeedPage, NotificationsPage, PushResponse } from '@stryde/shared'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, describe, expect, it } from 'vitest'
import { client, db } from '../db/client'
import { exercises } from '../db/schema'
import { PRESET_EXERCISES } from '../db/seed/exercises'
import { get, hasDatabase, postJson, signUpUser } from '../test/helpers'
import { befriend, HOUR, pushRows, sportSession, workout } from '../test/workouts'

// Sports (type 'sport'): logged by time, no sets or records, always their own session.

afterAll(() => client.end())

const SPORTS = ['Pickleball', 'Badminton', 'Basketball', 'Tennis', 'Soccer', 'Volleyball']

describe('sport presets', () => {
  it('has the six sports, each a sport with fixed ids', () => {
    const sports = PRESET_EXERCISES.filter((e) => e.type === 'sport')
    expect(sports.map((e) => e.name)).toEqual(SPORTS)
    expect(new Set(sports.map((e) => e.id)).size).toBe(6)
  })
})

describe.skipIf(!hasDatabase)('sports on the server', () => {
  it('stores the presets (the migration added the enum value)', async () => {
    const rows = await db.select().from(exercises)
    expect(
      rows
        .filter((e) => e.type === 'sport' && e.isPreset)
        .map((e) => e.name)
        .sort(),
    ).toEqual([...SPORTS].sort())
  })

  it('accepts a sport set with a duration and rejects one with only reps', async () => {
    const user = await signUpUser()
    const ok = sportSession(user.userId)
    await pushRows(user.cookie, ok.rows)

    const bad = sportSession(user.userId, { reps: 12 })
    const res = await postJson(
      '/api/sync/push',
      { clientId: uuidv7(), mutations: bad.rows },
      user.cookie,
    )
    const { results } = (await res.json()) as PushResponse
    const set = results.find((r) => r.table === 'sets')
    expect(set?.status).toBe('rejected')
  })

  it("shows in friends' feeds as a sport: time only, no PRs, flagged for the card", async () => {
    const actor = await signUpUser()
    const friend = await signUpUser()
    await befriend(actor, friend)
    const played = sportSession(actor.userId, { minutes: 90, finishedAgoMs: 10 * 60_000 })
    const lifted = workout(actor.userId, { name: 'Push Day', finishedAgoMs: 2 * HOUR })
    await pushRows(actor.cookie, played.rows)
    await pushRows(actor.cookie, lifted.rows)

    const feed = (await (await get('/api/feed', friend.cookie)).json()) as FeedPage
    const card = feed.items.find((i) => i.name === 'Pickleball')
    expect(card).toMatchObject({
      sport: true,
      durationSec: 5400,
      exerciseCount: 1,
      setCount: 1,
      prs: [],
    })
    expect(feed.items.find((i) => i.name === 'Push Day')?.sport).toBe(false)
  })

  it('a longer second session is not a record, and no PRs are stored', async () => {
    const user = await signUpUser()
    await pushRows(
      user.cookie,
      sportSession(user.userId, { minutes: 60, finishedAgoMs: 3 * 24 * HOUR }).rows,
    )
    await pushRows(user.cookie, sportSession(user.userId, { minutes: 150 }).rows)
    const own = (await (await get('/api/feed', user.cookie)).json()) as FeedPage
    expect(own.items.map((i) => i.prs.length)).toEqual([0, 0])
  })

  it('a friend\'s notification reads like "Finished Pickleball · 1h 30m"', async () => {
    const actor = await signUpUser()
    const friend = await signUpUser()
    await befriend(actor, friend)
    await pushRows(
      actor.cookie,
      sportSession(actor.userId, { minutes: 90, finishedAgoMs: 60_000 }).rows,
    )
    const list = (await (
      await get('/api/notifications', friend.cookie)
    ).json()) as NotificationsPage
    const n = list.items.find((i) => i.type === 'friend_workout_finished')
    expect(n?.body).toBe('Finished Pickleball · 1h 30m')
  })
})
