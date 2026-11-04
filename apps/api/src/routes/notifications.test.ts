import type {
  AppConfig,
  NotificationsPage,
  NotificationType,
  PushPayload,
  ReactionEmoji,
} from '@stryde/shared'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { client, db } from '../db/client'
import { friendMutes, pushSubscriptions, userSettings } from '../db/schema'
import { env } from '../env'
import { settlePushes } from '../services/notify'
import { type PushResult, setPushSender } from '../services/push'
import { get, hasDatabase, postJson, request, signUpUser } from '../test/helpers'
import { befriend, HOUR, pushRows, usernameOf, workout } from '../test/workouts'

// Notifications: settings gates, triggers, push delivery, list (plan/phase-09 §4).

type User = { cookie: string; userId: string }
const json = async <T>(res: Response) => (await res.json()) as T
const list = async (u: User) => json<NotificationsPage>(await get('/api/notifications', u.cookie))
// `befriend` itself creates friend_request / friend_accepted notifications; tests about
// other types ignore that setup noise.
const NOISE: NotificationType[] = ['friend_request', 'friend_accepted']
const inbox = async (u: User, ignore = NOISE) => {
  const items = (await list(u)).items.filter((i) => !ignore.includes(i.type))
  return { items, unread: items.filter((i) => i.readAt === null).length }
}
const types = async (u: User, ignore = NOISE) => (await inbox(u, ignore)).items.map((i) => i.type)

const sent: { endpoint: string; payload: PushPayload; ttlSeconds: number }[] = []
let nextResult: PushResult = 'sent'

async function subscribe(u: User) {
  const endpoint = `https://push.example.test/${uuidv7()}`
  const res = await postJson(
    '/api/push/subscribe',
    { endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } },
    u.cookie,
  )
  expect(res.status).toBe(200)
  return endpoint
}

const setSettings = (userId: string, patch: Partial<typeof userSettings.$inferInsert>) =>
  db.update(userSettings).set(patch).where(eq(userSettings.id, userId))

const react = (actor: User, sessionId: string, emoji: ReactionEmoji) =>
  request('PUT', `/api/sessions/${sessionId}/reaction`, actor.cookie, { emoji })

describe.skipIf(!hasDatabase)('notifications', () => {
  const original = { ...env }
  let restoreSender = () => {}
  beforeAll(() => {
    env.vapidPublicKey = 'test-public'
    env.vapidPrivateKey = 'test-private'
    env.vapidSubject = 'mailto:test@example.com'
    restoreSender = setPushSender(async (sub, payload, { ttlSeconds }) => {
      sent.push({ endpoint: sub.endpoint, payload, ttlSeconds })
      return nextResult
    })
  })
  afterEach(() => {
    sent.length = 0
    nextResult = 'sent'
  })
  afterAll(async () => {
    restoreSender()
    Object.assign(env, original)
    await client.end()
  })

  it('exposes the VAPID public key only when push is configured', async () => {
    expect((await json<AppConfig>(await get('/api/config'))).vapidPublicKey).toBe('test-public')
    env.vapidSubject = undefined
    expect((await json<AppConfig>(await get('/api/config'))).vapidPublicKey).toBeNull()
    env.vapidSubject = 'mailto:test@example.com'
  })

  it('stores subscriptions per endpoint, moves them to the latest user, deletes only your own', async () => {
    const a = await signUpUser()
    const b = await signUpUser()
    const endpoint = await subscribe(a)
    expect((await postJson('/api/push/subscribe', { endpoint: 'nope' }, a.cookie)).status).toBe(400)
    expect((await postJson('/api/push/subscribe', { endpoint }, undefined)).status).toBe(401)

    const owner = async () =>
      (await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)))[0]
        ?.userId
    expect(await owner()).toBe(a.userId)

    // Another account on the same browser takes the endpoint over.
    await postJson(
      '/api/push/subscribe',
      { endpoint, keys: { p256dh: 'k2', auth: 'a2' } },
      b.cookie,
    )
    expect(await owner()).toBe(b.userId)

    await request('DELETE', '/api/push/subscribe', a.cookie, { endpoint })
    expect(await owner()).toBe(b.userId)
    await request('DELETE', '/api/push/subscribe', b.cookie, { endpoint })
    expect(await owner()).toBeUndefined()
  })

  it('reaction: notifies the owner in-app and by push; replacing collapses; removal and self are silent', async () => {
    const owner = await signUpUser()
    const fan = await signUpUser()
    await befriend(owner, fan)
    const endpoint = await subscribe(owner)
    const w = workout(owner.userId, { name: 'Leg Day' })
    await pushRows(owner.cookie, w.rows)

    expect((await react(fan, w.session.id, 'fire')).status).toBe(200)
    await settlePushes()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      endpoint,
      ttlSeconds: 6 * 3600,
      payload: {
        type: 'reaction_received',
        title: 'Test User',
        body: '🔥 reacted to Leg Day',
        url: `/workout/${w.session.id}`,
        tag: `reaction-${w.session.id}`,
      },
    })
    expect(await types(owner)).toEqual(['reaction_received'])

    // Changing the emoji updates the unread row instead of stacking another one.
    await react(fan, w.session.id, 'trophy')
    const page = await inbox(owner)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.body).toBe('🏆 reacted to Leg Day')
    expect(page.unread).toBe(1)

    // Removing a reaction and reacting to your own workout notify nobody.
    await settlePushes()
    const before = sent.length
    await request('DELETE', `/api/sessions/${w.session.id}/reaction`, fan.cookie)
    await react(owner, w.session.id, 'clap')
    await settlePushes()
    expect(sent).toHaveLength(before)
    expect((await inbox(owner)).items).toHaveLength(1)
    expect(await types(fan)).not.toContain('reaction_received')
  })

  it('friend requests: request, accept and crossed requests', async () => {
    const a = await signUpUser()
    const b = await signUpUser()
    const c = await signUpUser()
    const [bName, aName] = [await usernameOf(b.cookie), await usernameOf(a.cookie)]

    await postJson('/api/friends/requests', { username: bName }, a.cookie)
    expect(await types(b, [])).toEqual(['friend_request'])
    expect((await list(b)).items[0]).toMatchObject({
      body: 'Sent you a friend request',
      url: '/friends',
    })

    const incoming = (
      await json<{ incoming: { id: string }[] }>(await get('/api/friends/requests', b.cookie))
    ).incoming
    await postJson(`/api/friends/requests/${incoming[0]?.id}/accept`, {}, b.cookie)
    expect(await types(a, [])).toEqual(['friend_accepted'])

    // Crossed: c asks b, then b asks c back, which accepts: c is told.
    await postJson('/api/friends/requests', { username: bName }, c.cookie)
    await postJson('/api/friends/requests', { username: await usernameOf(c.cookie) }, b.cookie)
    expect(await types(c, [])).toEqual(['friend_accepted'])
    expect(aName).toBeTruthy()
  })

  it('friend workout finished: fresh workouts notify friends; late syncs, private sessions and non-friends do not', async () => {
    const actor = await signUpUser()
    const friend = await signUpUser()
    const stranger = await signUpUser()
    await befriend(actor, friend)
    const endpoint = await subscribe(friend)

    const fresh = workout(actor.userId, {
      name: 'Push Day',
      finishedAgoMs: 10 * 60_000,
      durationMs: 72 * 60_000,
    })
    await pushRows(actor.cookie, fresh.rows)
    await settlePushes()
    expect(await types(friend)).toEqual(['friend_workout_finished'])
    expect(sent.at(-1)).toMatchObject({
      endpoint,
      payload: {
        title: 'Test User',
        body: 'Finished Push Day · 1h 12m',
        url: `/workout/${fresh.session.id}`,
      },
    })
    expect(await types(stranger)).toEqual([])
    expect(await types(actor)).toEqual([])

    // Finished 3 h ago and synced now: in the feed, but no notification.
    await pushRows(
      actor.cookie,
      workout(actor.userId, { name: 'Late', finishedAgoMs: 3 * HOUR }).rows,
    )
    // Private sessions never notify.
    await pushRows(
      actor.cookie,
      workout(actor.userId, { name: 'Secret', finishedAgoMs: 60_000, shareWithFriends: false })
        .rows,
    )
    await settlePushes()
    expect((await inbox(friend)).items).toHaveLength(1)

    // Resharing later creates no notification either.
    const toggled = workout(actor.userId, {
      name: 'Toggled',
      finishedAgoMs: 60_000,
      shareWithFriends: false,
    })
    await pushRows(actor.cookie, toggled.rows)
    await pushRows(actor.cookie, [
      {
        table: 'sessions',
        row: { ...toggled.session, shareWithFriends: true, updatedAt: new Date().toISOString() },
      },
    ])
    expect((await inbox(friend)).items).toHaveLength(1)
  })

  it('PR count is in the workout notification', async () => {
    const actor = await signUpUser()
    const friend = await signUpUser()
    await befriend(actor, friend)
    await pushRows(
      actor.cookie,
      workout(actor.userId, { finishedAgoMs: 2 * 24 * HOUR, weightKg: 80 }).rows,
    )
    await pushRows(
      actor.cookie,
      workout(actor.userId, { name: 'Heavy', finishedAgoMs: 60_000, weightKg: 100 }).rows,
    )
    const [n] = (await inbox(friend)).items
    expect(n?.body).toBe('Finished Heavy · 1h 0m · 3 PRs')
  })

  it.each([
    ['mute all', { notificationsMuted: true }],
    ['the reactions switch', { notifyReactions: false }],
  ])('settings gate: %s', async (_, patch) => {
    const owner = await signUpUser()
    const fan = await signUpUser()
    await befriend(owner, fan)
    await subscribe(owner)
    const w = workout(owner.userId)
    await pushRows(owner.cookie, w.rows)
    await setSettings(owner.userId, patch)

    await react(fan, w.session.id, 'fire')
    await settlePushes()
    expect(sent).toHaveLength(0)
    expect(await types(owner)).toEqual([])

    // A different type still gets through when only one switch is off.
    if ('notifyReactions' in patch) {
      await postJson(
        '/api/friends/requests',
        { username: await usernameOf(owner.cookie) },
        (await signUpUser()).cookie,
      )
      expect(await types(owner, ['friend_accepted'])).toEqual(['friend_request'])
    }
  })

  it('a muted friend triggers no workout or reaction notifications, but still shows in the feed', async () => {
    const me = await signUpUser()
    const friend = await signUpUser()
    await befriend(me, friend)
    await request('PUT', `/api/friends/${friend.userId}/mute`, me.cookie)

    await pushRows(friend.cookie, workout(friend.userId, { finishedAgoMs: 60_000 }).rows)
    expect(await types(me)).toEqual([])
    const feed = await json<{ items: unknown[] }>(await get('/api/feed', me.cookie))
    expect(feed.items).toHaveLength(1)

    const mine = workout(me.userId)
    await pushRows(me.cookie, mine.rows)
    await react(friend, mine.session.id, 'fire')
    expect(await types(me)).toEqual([])

    // Unmuting restores them; unfriending clears the mute.
    await request('DELETE', `/api/friends/${friend.userId}/mute`, me.cookie)
    await pushRows(friend.cookie, workout(friend.userId, { finishedAgoMs: 30_000 }).rows)
    expect(await types(me)).toEqual(['friend_workout_finished'])
    await request('PUT', `/api/friends/${friend.userId}/mute`, me.cookie)
    await request('DELETE', `/api/friends/${friend.userId}`, me.cookie)
    expect(await db.select().from(friendMutes).where(eq(friendMutes.userId, me.userId))).toEqual([])
  })

  it('removes subscriptions the push service reports gone and stamps the ones it reached', async () => {
    const owner = await signUpUser()
    const fan = await signUpUser()
    await befriend(owner, fan)
    const endpoint = await subscribe(owner)
    const w = workout(owner.userId)
    await pushRows(owner.cookie, w.rows)
    const row = () =>
      db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))

    await react(fan, w.session.id, 'fire')
    await settlePushes()
    expect((await row())[0]?.lastUsedAt).toBeInstanceOf(Date)

    nextResult = 'gone'
    await react(fan, w.session.id, 'clap')
    await settlePushes()
    expect(await row()).toEqual([])
    // The in-app notification survives the dead subscription.
    expect(await types(owner)).toEqual(['reaction_received'])
  })

  it('lists newest first with an unread count, paginates, and marks read', async () => {
    const me = await signUpUser()
    const others = await Promise.all([signUpUser(), signUpUser(), signUpUser()])
    const myName = await usernameOf(me.cookie)
    for (const o of others) await postJson('/api/friends/requests', { username: myName }, o.cookie)

    const all = await list(me)
    expect(all.items).toHaveLength(3)
    expect(all.unreadCount).toBe(3)
    expect(all.nextCursor).toBeNull()
    expect(all.items.every((i) => i.readAt === null)).toBe(true)

    const p1 = await json<NotificationsPage>(await get('/api/notifications?limit=2', me.cookie))
    expect(p1.items).toHaveLength(2)
    const p2 = await json<NotificationsPage>(
      await get(
        `/api/notifications?limit=2&before=${encodeURIComponent(p1.nextCursor ?? '')}`,
        me.cookie,
      ),
    )
    expect(p2.items).toHaveLength(1)
    expect(p2.nextCursor).toBeNull()
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(3)

    // Mark one read (someone else's id is ignored), then all.
    const strangerIds = (await list(others[0] as User)).items.map((i) => i.id)
    const first = all.items[0]?.id ?? ''
    expect(
      await json(
        await postJson('/api/notifications/read', { ids: [first, ...strangerIds] }, me.cookie),
      ),
    ).toEqual({ updated: 1 })
    expect((await list(me)).unreadCount).toBe(2)
    expect(await json(await postJson('/api/notifications/read', {}, me.cookie))).toEqual({
      updated: 2,
    })
    expect((await list(me)).unreadCount).toBe(0)
    expect((await postJson('/api/notifications/read', { ids: ['x'] }, me.cookie)).status).toBe(400)
    expect((await get('/api/notifications?limit=0', me.cookie)).status).toBe(400)
    expect((await get('/api/notifications')).status).toBe(401)
  })
})
