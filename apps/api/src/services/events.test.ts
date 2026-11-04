import type { ServerEvent } from '@stryde/shared'
import { Hono } from 'hono'
import { afterAll, describe, expect, it } from 'vitest'
import { client } from '../db/client'
import { createEventsRoute } from '../routes/events'
import { hasDatabase, postJson, request, signUpUser } from '../test/helpers'
import { befriend, pushRows, workout } from '../test/workouts'
import { connectionCount, publish, subscribe } from './events'

// SSE hub and route (plan/phase-09 §6).

afterAll(() => client.end())

/** One reader over an SSE response; `until` reads (and accumulates) until `done(text)`. */
function openStream(res: Response) {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let text = ''
  return {
    async until(done: (text: string) => boolean, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs
      while (!done(text) && Date.now() < deadline) {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<null>((r) => setTimeout(() => r(null), 200)),
        ])
        if (chunk && !chunk.done) text += decoder.decode(chunk.value)
      }
      return text
    },
    cancel: () => reader.cancel(),
  }
}

describe('events hub', () => {
  it('delivers to every listener of the addressed users only, and unsubscribes', () => {
    const got: string[] = []
    const off1 = subscribe('u1', (e) => got.push(`a:${e.type}`))
    const off2 = subscribe('u1', (e) => got.push(`b:${e.type}`))
    const off3 = subscribe('u2', (e) => got.push(`c:${e.type}`))
    publish('u1', { type: 'feed' })
    publish(['u2', 'nobody'], { type: 'notification' })
    expect(got).toEqual(['a:feed', 'b:feed', 'c:notification'])
    expect(connectionCount('u1')).toBe(2)
    off1()
    off2()
    off3()
    expect(connectionCount('u1')).toBe(0)
    publish('u1', { type: 'feed' })
    expect(got).toHaveLength(3)
  })

  it('survives a listener that throws', () => {
    const got: string[] = []
    const off1 = subscribe('u3', () => {
      throw new Error('boom')
    })
    const off2 = subscribe('u3', (e) => got.push(e.type))
    publish('u3', { type: 'sync', origin: null })
    expect(got).toEqual(['sync'])
    off1()
    off2()
  })
})

describe.skipIf(!hasDatabase)('GET /api/events', () => {
  it('requires a session', async () => {
    const app = new Hono().route('/events', createEventsRoute(20))
    expect((await app.request('/events')).status).toBe(401)
  })

  it('streams events as SSE with heartbeats, only to the signed-in user, and cleans up', async () => {
    const app = new Hono().route('/events', createEventsRoute(30))
    const a = await signUpUser()
    const b = await signUpUser()
    const res = await app.request('/events', { headers: { Cookie: a.cookie } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-cache')

    const stream = openStream(res)
    const first = await stream.until((t) => t.includes(': ping'))
    expect(first).toContain('event: ready')
    expect(first).toContain(': ping')
    expect(connectionCount(a.userId)).toBe(1)

    publish(b.userId, { type: 'feed' })
    publish(a.userId, { type: 'notification' })
    const all = await stream.until((t) => t.includes('event: notification'))
    expect(all).toContain(`event: notification\ndata: ${JSON.stringify({ type: 'notification' })}`)
    expect(all).not.toContain('event: feed')

    await stream.cancel()
    await new Promise((r) => setTimeout(r, 150))
    expect(connectionCount(a.userId)).toBe(0)
  })
})

describe.skipIf(!hasDatabase)('events from the app', () => {
  it("a push tells the same user's devices to sync (with the pusher as origin)", async () => {
    const u = await signUpUser()
    const events: ServerEvent[] = []
    const off = subscribe(u.userId, (e) => events.push(e))
    const clientId = crypto.randomUUID()
    const w = workout(u.userId)
    const res = await postJson('/api/sync/push', { clientId, mutations: w.rows }, u.cookie)
    expect(res.status).toBe(200)
    off()
    expect(events).toContainEqual({ type: 'sync', origin: clientId })
  })

  it("a finished shared workout refreshes friends' feeds, a private one does not", async () => {
    const actor = await signUpUser()
    const friend = await signUpUser()
    await befriend(actor, friend)
    const events: ServerEvent[] = []
    const off = subscribe(friend.userId, (e) => events.push(e))

    await pushRows(actor.cookie, workout(actor.userId, { shareWithFriends: false }).rows)
    expect(events.filter((e) => e.type === 'feed')).toHaveLength(0)
    await pushRows(actor.cookie, workout(actor.userId).rows)
    off()
    expect(events.filter((e) => e.type === 'feed')).toHaveLength(1)
  })

  it("a reaction (or its removal) refreshes the owner's open feed", async () => {
    const owner = await signUpUser()
    const fan = await signUpUser()
    await befriend(owner, fan)
    const w = workout(owner.userId)
    await pushRows(owner.cookie, w.rows)
    const events: ServerEvent[] = []
    const off = subscribe(owner.userId, (e) => events.push(e))

    await request('PUT', `/api/sessions/${w.session.id}/reaction`, fan.cookie, { emoji: 'fire' })
    await request('DELETE', `/api/sessions/${w.session.id}/reaction`, fan.cookie)
    off()
    expect(events.filter((e) => e.type === 'feed')).toHaveLength(2)
  })
})
