import { afterAll, describe, expect, it } from 'vitest'
import { client } from '../db/client'
import { cookieFrom, get, hasDatabase, postJson, uniqueUser } from '../test/helpers'

type MeBody = {
  user: { id: string; email: string; username: string | null; displayName: string }
  settings: { id: string; userId: string; unit: string; defaultRestSeconds: number }
  needsOnboarding: boolean
}

describe.skipIf(!hasDatabase)('auth', () => {
  afterAll(() => client.end())

  async function signUp(u = uniqueUser()) {
    const res = await postJson('/api/auth/sign-up/email', u)
    return { res, u }
  }

  it('signs up with email + username and creates default settings', async () => {
    const { res, u } = await signUp()
    expect(res.status).toBe(200)
    const me = await get('/api/me', cookieFrom(res))
    expect(me.status).toBe(200)
    const body = (await me.json()) as MeBody
    expect(body.user.email).toBe(u.email)
    expect(body.user.username).toBe(u.username)
    expect(body.needsOnboarding).toBe(false)
    expect(body.settings).toMatchObject({
      id: body.user.id,
      userId: body.user.id,
      unit: 'kg',
      defaultRestSeconds: 120,
    })
  })

  it('lowercases usernames', async () => {
    const u = uniqueUser()
    const { res } = await signUp({ ...u, username: u.username.toUpperCase() })
    expect(res.status).toBe(200)
    const body = (await (await get('/api/me', cookieFrom(res))).json()) as MeBody
    expect(body.user.username).toBe(u.username)
  })

  it('rejects sign-up without a username', async () => {
    const { username: _, ...noUsername } = uniqueUser()
    const res = await postJson('/api/auth/sign-up/email', noUsername)
    expect(res.status).toBe(400)
  })

  it.each([['ab'], ['has space'], ['dots.not.ok'], ['x'.repeat(21)]])(
    'rejects invalid username %s',
    async (username) => {
      const { res } = await signUp({ ...uniqueUser(), username })
      expect(res.status).toBe(400)
    },
  )

  it('rejects a duplicate username', async () => {
    const { u } = await signUp()
    const { res } = await signUp({ ...uniqueUser(), username: u.username })
    expect(res.status).toBe(400)
  })

  it('signs in by email', async () => {
    const { u } = await signUp()
    const res = await postJson('/api/auth/sign-in/email', { email: u.email, password: u.password })
    expect(res.status).toBe(200)
    expect((await get('/api/me', cookieFrom(res))).status).toBe(200)
  })

  it('signs in by username', async () => {
    const { u } = await signUp()
    const res = await postJson('/api/auth/sign-in/username', {
      username: u.username,
      password: u.password,
    })
    expect(res.status).toBe(200)
    expect((await get('/api/me', cookieFrom(res))).status).toBe(200)
  })

  it('rejects a wrong password', async () => {
    const { u } = await signUp()
    const res = await postJson('/api/auth/sign-in/username', {
      username: u.username,
      password: 'wrong-password',
    })
    expect(res.status).toBe(401)
  })

  it('/api/me requires a session', async () => {
    const res = await get('/api/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in required' },
    })
  })

  it('sets a 60-day httpOnly lax session cookie', async () => {
    const { res } = await signUp()
    const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token'))
    expect(cookie).toBeDefined()
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie ?? '')?.[1])
    expect(maxAge).toBe(60 * 24 * 60 * 60)
  })

  it('reports username availability', async () => {
    const { u } = await signUp()
    const taken = await (await get(`/api/users/username-available?u=${u.username}`)).json()
    expect(taken).toEqual({ username: u.username, available: false, valid: true })
    const free = await (await get('/api/users/username-available?u=Nobody_Has_This')).json()
    expect(free).toEqual({ username: 'nobody_has_this', available: true, valid: true })
    const invalid = await (await get('/api/users/username-available?u=no')).json()
    expect(invalid).toMatchObject({ available: false, valid: false })
  })

  it('lets a user without a username set one via update-user (Google onboarding)', async () => {
    // Simulate a Google user: sign up, then null the username directly.
    const { res, u } = await signUp()
    const cookie = cookieFrom(res)
    const { db } = await import('../db/client')
    const { user } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(user).set({ username: null }).where(eq(user.email, u.email))

    const before = (await (await get('/api/me', cookie)).json()) as MeBody
    expect(before.needsOnboarding).toBe(true)

    const newName = uniqueUser().username
    const upd = await postJson('/api/auth/update-user', { username: newName }, cookie)
    expect(upd.status).toBe(200)
    const after = (await (await get('/api/me', cookie)).json()) as MeBody
    expect(after.user.username).toBe(newName)
    expect(after.needsOnboarding).toBe(false)
  })
})
