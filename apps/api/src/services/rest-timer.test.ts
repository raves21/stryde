import type { NotificationsPage, PushPayload } from '@stryde/shared'
import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { client, db } from '../db/client'
import { scheduledPushes, userSettings } from '../db/schema'
import { env } from '../env'
import { get, hasDatabase, postJson, request, signUpUser } from '../test/helpers'
import { pushRows, workout } from '../test/workouts'
import { settlePushes } from './notify'
import { setPushSender } from './push'
import { MAX_LATE_MS, runDueRestPushes, startRestPushScheduler } from './rest-timer'

// Rest-timer push (plan/phase-09 §5): scheduled by the client, sent by the server loop.

type User = { cookie: string; userId: string }
const sent: PushPayload[] = []
/** The loop is global (it also sends other tests' due rows); count one workout's alerts. */
const alertsFor = (sessionId: string) => sent.filter((p) => p.tag === `rest-${sessionId}`)

/** An in-progress workout for `u` (finishedAt null); returns its session id. */
async function startWorkout(u: User) {
  const w = workout(u.userId)
  await pushRows(u.cookie, [
    { table: 'sessions', row: { ...w.session, finishedAt: null } },
    { table: 'sessionExercises', row: w.se },
    { table: 'sets', row: w.set },
  ])
  await postJson(
    '/api/push/subscribe',
    { endpoint: `https://push.example.test/${uuidv7()}`, keys: { p256dh: 'k', auth: 'a' } },
    u.cookie,
  )
  return w
}

const schedule = (u: User, sessionId: string, fireAt: Date) =>
  postJson('/api/rest-timer', { sessionId, fireAt: fireAt.toISOString() }, u.cookie)

describe.skipIf(!hasDatabase)('rest-timer push', () => {
  const original = { ...env }
  let restoreSender = () => {}
  beforeAll(() => {
    env.vapidPublicKey = 'test-public'
    env.vapidPrivateKey = 'test-private'
    env.vapidSubject = 'mailto:test@example.com'
    restoreSender = setPushSender(async (_sub, payload) => {
      sent.push(payload)
      return 'sent'
    })
  })
  afterEach(() => {
    sent.length = 0
  })
  afterAll(async () => {
    restoreSender()
    Object.assign(env, original)
    await client.end()
  })

  it('validates the request: needs a session, an active one that is yours, and a sane time', async () => {
    const u = await signUpUser()
    const other = await signUpUser()
    const w = await startWorkout(u)
    const soon = new Date(Date.now() + 60_000)

    expect(
      (await postJson('/api/rest-timer', { sessionId: 'x', fireAt: 'y' }, u.cookie)).status,
    ).toBe(400)
    expect(
      (await postJson('/api/rest-timer', { sessionId: w.session.id, fireAt: soon.toISOString() }))
        .status,
    ).toBe(401)
    expect((await schedule(u, uuidv7(), soon)).status).toBe(404)
    expect((await schedule(other, w.session.id, soon)).status).toBe(404)
    expect((await schedule(u, w.session.id, new Date(Date.now() + 2 * 3600_000))).status).toBe(400)
    expect((await schedule(u, w.session.id, soon)).status).toBe(200)

    const done = workout(u.userId)
    await pushRows(u.cookie, done.rows)
    expect((await schedule(u, done.session.id, soon)).status).toBe(404)
  })

  it('sends one push-only alert when due, never again', async () => {
    const u = await signUpUser()
    const w = await startWorkout(u)
    const fireAt = new Date(Date.now() + 60_000)
    await schedule(u, w.session.id, fireAt)

    await runDueRestPushes(db, new Date(fireAt.getTime() - 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(0)
    await runDueRestPushes(db, new Date(fireAt.getTime() + 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toEqual([
      {
        type: 'rest_timer_done',
        title: 'Rest is over',
        body: 'Time for your next set',
        url: '/workout/active',
        tag: `rest-${w.session.id}`,
      },
    ])
    await runDueRestPushes(db, new Date(fireAt.getTime() + 2_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(1)

    // Push only: nothing in the in-app list.
    const page = (await (await get('/api/notifications', u.cookie)).json()) as NotificationsPage
    expect(page.items.filter((i) => i.type === 'rest_timer_done')).toEqual([])
  })

  it('a new timer replaces the old one; deleting cancels', async () => {
    const u = await signUpUser()
    const w = await startWorkout(u)
    const first = new Date(Date.now() + 60_000)
    const second = new Date(Date.now() + 90_000)
    await schedule(u, w.session.id, first)
    await schedule(u, w.session.id, second)

    // The first timer was replaced: its time passes without an alert.
    await runDueRestPushes(db, new Date(first.getTime() + 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(0)
    await runDueRestPushes(db, new Date(second.getTime() + 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(1)

    await schedule(u, w.session.id, new Date(Date.now() + 120_000))
    expect((await request('DELETE', '/api/rest-timer', u.cookie)).status).toBe(200)
    await runDueRestPushes(db, new Date(Date.now() + 3600_000 * 2))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(1)
  })

  it('drops alerts that are too late (e.g. the server was down) and marks them cancelled', async () => {
    const u = await signUpUser()
    const w = await startWorkout(u)
    const fireAt = new Date(Date.now() + 60_000)
    await schedule(u, w.session.id, fireAt)

    await runDueRestPushes(db, new Date(fireAt.getTime() + MAX_LATE_MS + 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(0)
    const [row] = await db
      .select()
      .from(scheduledPushes)
      .where(eq(scheduledPushes.userId, u.userId))
    expect(row?.cancelledAt).toBeInstanceOf(Date)
    expect(row?.sentAt).toBeNull()
  })

  it('skips the alert when the workout already finished, or when the user turned it off', async () => {
    const u = await signUpUser()
    const w = await startWorkout(u)
    const fireAt = new Date(Date.now() + 60_000)
    await schedule(u, w.session.id, fireAt)
    await pushRows(u.cookie, [
      { table: 'sessions', row: { ...w.session, updatedAt: new Date().toISOString() } },
    ])
    await runDueRestPushes(db, new Date(fireAt.getTime() + 1_000))
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(0)

    const settingsUser = await signUpUser()
    const active = await startWorkout(settingsUser)
    for (const patch of [{ notifyRestTimer: false }, { notificationsMuted: true }]) {
      await db.update(userSettings).set(patch).where(eq(userSettings.id, settingsUser.userId))
      const at = new Date(Date.now() + 60_000)
      await schedule(settingsUser, active.session.id, at)
      await runDueRestPushes(db, new Date(at.getTime() + 1_000))
      await settlePushes()
      expect(alertsFor(active.session.id)).toHaveLength(0)
      await db
        .update(userSettings)
        .set({ notifyRestTimer: true, notificationsMuted: false })
        .where(eq(userSettings.id, settingsUser.userId))
    }
  })

  it('the loop sends due alerts on its own and stops when told', async () => {
    const u = await signUpUser()
    const w = await startWorkout(u)
    await schedule(u, w.session.id, new Date(Date.now() + 150))
    const stop = startRestPushScheduler(db, 40)
    await new Promise((r) => setTimeout(r, 600))
    stop()
    await settlePushes()
    expect(alertsFor(w.session.id)).toHaveLength(1)
  })
})
