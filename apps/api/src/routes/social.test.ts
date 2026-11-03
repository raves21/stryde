import type {
  FeedPage,
  Friend,
  FriendRequests,
  Reactor,
  SessionDetail,
  UserSearchResult,
} from '@stryde/shared'
import { v7 as uuidv7 } from 'uuid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client } from '../db/client'
import { get, hasDatabase, postJson, request, signUpUser } from '../test/helpers'
import {
  BENCH,
  befriend,
  DAY,
  HOUR,
  pushRows,
  SQUAT,
  updateSession,
  usernameOf,
  workout,
} from '../test/workouts'

// Social: friendships, authorization, feed, reactions (plan/phase-08, DATA_MODEL_AND_SYNC.md §6–§7).

type User = { cookie: string; userId: string }
const json = async <T>(res: Response) => (await res.json()) as T
const feedOf = async (u: User, query = '') =>
  json<FeedPage>(await get(`/api/feed${query}`, u.cookie))
afterAll(() => client.end())

const sessionIdsOf = (page: FeedPage) => page.items.map((i) => i.sessionId)

describe.skipIf(!hasDatabase)('friends', () => {
  let ann: User
  let bob: User
  let cat: User
  beforeAll(async () => {
    ;[ann, bob, cat] = await Promise.all([signUpUser(), signUpUser(), signUpUser()])
  })

  it('requires a session', async () => {
    expect((await get('/api/friends')).status).toBe(401)
    expect((await get('/api/feed')).status).toBe(401)
    expect((await get(`/api/sessions/${uuidv7()}`)).status).toBe(401)
    expect((await get('/api/users/search?q=a')).status).toBe(401)
  })

  it('searches by username prefix: public profile only, never the caller, max 10', async () => {
    const bobName = await usernameOf(bob.cookie)
    const res = await json<{ users: UserSearchResult[] }>(
      await get(`/api/users/search?q=${bobName.slice(0, 8)}`, ann.cookie),
    )
    const hit = res.users.find((u) => u.username === bobName)
    expect(hit).toEqual({
      username: bobName,
      displayName: 'Test User',
      avatarUrl: null,
      relation: 'none',
    })
    expect(Object.keys(hit ?? {}).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'relation',
      'username',
    ])
    expect(res.users.length).toBeLessThanOrEqual(10)

    const annName = await usernameOf(ann.cookie)
    const own = await json<{ users: UserSearchResult[] }>(
      await get(`/api/users/search?q=${annName.slice(0, 8)}`, ann.cookie),
    )
    expect(own.users.some((u) => u.username === annName)).toBe(false)
    expect((await get('/api/users/search?q=', ann.cookie)).status).toBe(400)
  })

  it('request → pending states → accept makes them friends', async () => {
    const bobName = await usernameOf(bob.cookie)
    expect(
      (await postJson('/api/friends/requests', { username: bobName }, ann.cookie)).status,
    ).toBe(200)

    const dup = await postJson('/api/friends/requests', { username: bobName }, ann.cookie)
    expect(dup.status).toBe(409)
    expect(await json(dup)).toEqual({
      error: { code: 'already_requested', message: expect.any(String) },
    })

    const search = await json<{ users: UserSearchResult[] }>(
      await get(`/api/users/search?q=${bobName}`, ann.cookie),
    )
    expect(search.users.find((u) => u.username === bobName)?.relation).toBe('outgoing')

    const annRequests = await json<FriendRequests>(await get('/api/friends/requests', ann.cookie))
    expect(annRequests.outgoing.map((r) => r.user.username)).toEqual([bobName])
    const bobRequests = await json<FriendRequests>(await get('/api/friends/requests', bob.cookie))
    expect(bobRequests.incoming).toHaveLength(1)
    const id = bobRequests.incoming[0]?.id ?? ''

    // Only the addressee can answer.
    expect((await postJson(`/api/friends/requests/${id}/accept`, {}, ann.cookie)).status).toBe(404)
    expect(
      (await postJson(`/api/friends/requests/${uuidv7()}/accept`, {}, bob.cookie)).status,
    ).toBe(404)
    expect((await postJson('/api/friends/requests/not-a-uuid/accept', {}, bob.cookie)).status).toBe(
      404,
    )
    expect((await postJson(`/api/friends/requests/${id}/accept`, {}, bob.cookie)).status).toBe(200)

    const friends = await json<{ friends: Friend[] }>(await get('/api/friends', ann.cookie))
    expect(friends.friends.map((f) => f.username)).toEqual([bobName])
    expect(friends.friends[0]).toMatchObject({ muted: false, lastWorkoutAt: null })
    expect(
      (await postJson('/api/friends/requests', { username: bobName }, ann.cookie)).status,
    ).toBe(409)
  })

  it('rejects unknown users and adding yourself', async () => {
    expect(
      (await postJson('/api/friends/requests', { username: 'nobody_here_x' }, ann.cookie)).status,
    ).toBe(404)
    const self = await postJson(
      '/api/friends/requests',
      { username: await usernameOf(ann.cookie) },
      ann.cookie,
    )
    expect(self.status).toBe(400)
    expect((await postJson('/api/friends/requests', {}, ann.cookie)).status).toBe(400)
  })

  it('crossed requests accept each other; decline allows asking again; unfriend removes', async () => {
    const a = await signUpUser()
    const b = await signUpUser()
    const [aName, bName] = [await usernameOf(a.cookie), await usernameOf(b.cookie)]

    await postJson('/api/friends/requests', { username: bName }, a.cookie)
    const crossed = await postJson('/api/friends/requests', { username: aName }, b.cookie)
    expect(await json(crossed)).toEqual({ status: 'accepted' })
    expect(
      (await json<{ friends: Friend[] }>(await get('/api/friends', a.cookie))).friends,
    ).toHaveLength(1)

    expect((await request('DELETE', `/api/friends/${b.userId}`, a.cookie)).status).toBe(200)
    expect(
      (await json<{ friends: Friend[] }>(await get('/api/friends', b.cookie))).friends,
    ).toHaveLength(0)
    expect((await request('DELETE', `/api/friends/${b.userId}`, a.cookie)).status).toBe(404)

    // Declined → the requester sees nothing pending, and either side can ask again.
    await postJson('/api/friends/requests', { username: bName }, a.cookie)
    const pending = await json<FriendRequests>(await get('/api/friends/requests', b.cookie))
    await postJson(`/api/friends/requests/${pending.incoming[0]?.id}/decline`, {}, b.cookie)
    expect(
      (await json<FriendRequests>(await get('/api/friends/requests', b.cookie))).incoming,
    ).toHaveLength(0)
    expect((await postJson('/api/friends/requests', { username: aName }, b.cookie)).status).toBe(
      200,
    )
    expect(
      (await json<FriendRequests>(await get('/api/friends/requests', a.cookie))).incoming,
    ).toHaveLength(1)

    // A pending request can be cancelled by its sender only.
    expect((await request('DELETE', `/api/friends/${a.userId}`, a.cookie)).status).toBe(404)
    expect((await request('DELETE', `/api/friends/${a.userId}`, b.cookie)).status).toBe(200)
  })

  it('mutes and unmutes friends only', async () => {
    expect((await request('PUT', `/api/friends/${cat.userId}/mute`, ann.cookie)).status).toBe(404)
    expect((await request('PUT', `/api/friends/${bob.userId}/mute`, ann.cookie)).status).toBe(200)
    const muted = await json<{ friends: Friend[] }>(await get('/api/friends', ann.cookie))
    expect(muted.friends[0]?.muted).toBe(true)
    expect((await request('DELETE', `/api/friends/${bob.userId}/mute`, ann.cookie)).status).toBe(
      200,
    )
    expect(
      (await json<{ friends: Friend[] }>(await get('/api/friends', ann.cookie))).friends[0]?.muted,
    ).toBe(false)
  })
})

describe.skipIf(!hasDatabase)('authorization, feed and reactions', () => {
  let me: User
  let friend: User
  let stranger: User
  let pendingUser: User
  beforeAll(async () => {
    ;[me, friend, stranger, pendingUser] = await Promise.all([
      signUpUser(),
      signUpUser(),
      signUpUser(),
      signUpUser(),
    ])
    await befriend(me, friend)
    // pendingUser has asked me, but I haven't accepted.
    await postJson(
      '/api/friends/requests',
      { username: await usernameOf(me.cookie) },
      pendingUser.cookie,
    )
  })

  const visibleTo = async (viewer: User, sessionId: string) =>
    (await get(`/api/sessions/${sessionId}`, viewer.cookie)).status

  it('shows a shared finished session to the owner and friends only (404 otherwise)', async () => {
    const w = workout(friend.userId, { name: 'Leg Day' })
    await pushRows(friend.cookie, w.rows)
    const id = w.session.id
    expect(await visibleTo(friend, id)).toBe(200)
    expect(await visibleTo(me, id)).toBe(200)
    expect(await visibleTo(stranger, id)).toBe(404)
    expect(await visibleTo(pendingUser, id)).toBe(404)
    expect((await get('/api/sessions/not-a-uuid', me.cookie)).status).toBe(404)
    expect((await get(`/api/sessions/${uuidv7()}`, me.cookie)).status).toBe(404)

    const detail = (
      await json<{ session: SessionDetail }>(await get(`/api/sessions/${id}`, me.cookie))
    ).session
    expect(detail).toMatchObject({
      name: 'Leg Day',
      owner: { userId: friend.userId, isMe: false, displayName: 'Test User' },
      myReaction: null,
    })
    expect(detail.exercises[0]).toMatchObject({ exerciseId: BENCH, name: 'Bench Press' })
    expect(detail.exercises[0]?.sets).toEqual([
      expect.objectContaining({ weightKg: 100, reps: 5, setType: 'working' }),
    ])
  })

  it('a private, deleted or unfinished session is invisible to friends', async () => {
    const priv = workout(friend.userId, { shareWithFriends: false })
    await pushRows(friend.cookie, priv.rows)
    expect(await visibleTo(friend, priv.session.id)).toBe(200)
    expect(await visibleTo(me, priv.session.id)).toBe(404)

    const gone = workout(friend.userId)
    await pushRows(friend.cookie, gone.rows)
    expect(await visibleTo(me, gone.session.id)).toBe(200)
    await updateSession(friend.cookie, gone, { deletedAt: new Date().toISOString() })
    expect(await visibleTo(me, gone.session.id)).toBe(404)
    expect(await visibleTo(friend, gone.session.id)).toBe(404)

    const active = workout(friend.userId)
    await pushRows(friend.cookie, [
      { table: 'sessions', row: { ...active.session, finishedAt: null } },
    ])
    expect(await visibleTo(me, active.session.id)).toBe(404)
  })

  it('feed has me and my friends only, newest finish first, with a late sync at its real time', async () => {
    const [u1, u2, u3, u4] = await Promise.all([
      signUpUser(),
      signUpUser(),
      signUpUser(),
      signUpUser(),
    ])
    await befriend(u1, u2)
    const mine = workout(u1.userId, { name: 'Mine', finishedAgoMs: 2 * HOUR })
    const theirs = workout(u2.userId, { name: 'Theirs', finishedAgoMs: 1 * HOUR })
    const late = workout(u2.userId, { name: 'Late', finishedAgoMs: 3 * HOUR })
    const hidden = workout(u2.userId, { name: 'Hidden', shareWithFriends: false })
    const other = workout(u3.userId, { name: 'Other' })
    const unfinished = workout(u2.userId, { name: 'Active' })
    await pushRows(u1.cookie, mine.rows)
    await pushRows(u2.cookie, [...theirs.rows, ...late.rows, ...hidden.rows])
    await pushRows(u3.cookie, other.rows)
    await pushRows(u2.cookie, [
      { table: 'sessions', row: { ...unfinished.session, finishedAt: null } },
    ])

    const page = await feedOf(u1)
    expect(page.items.map((i) => i.name)).toEqual(['Theirs', 'Mine', 'Late'])
    expect(page.nextCursor).toBeNull()
    const [first, second] = page.items
    expect(first).toMatchObject({
      actor: { userId: u2.userId, isMe: false },
      exerciseCount: 1,
      setCount: 1,
      durationSec: 3600,
      reactions: {},
      myReaction: null,
    })
    expect(second?.actor.isMe).toBe(true)
    // Late sync: the card keeps the time the workout finished, not the sync time.
    const lateItem = page.items.find((i) => i.name === 'Late')
    expect(lateItem?.finishedAt).toBe(late.session.finishedAt)

    // A stranger's feed has none of it; u4 with no friends sees only their own.
    expect((await feedOf(u4)).items).toEqual([])
    // Friends see each other symmetrically.
    expect((await feedOf(u2)).items.map((i) => i.name)).toEqual(['Theirs', 'Mine', 'Late'])
  })

  it('paginates with a cursor', async () => {
    const u = await signUpUser()
    for (const [i, name] of ['a', 'b', 'c', 'd', 'e'].entries()) {
      await pushRows(u.cookie, workout(u.userId, { name, finishedAgoMs: (i + 1) * HOUR }).rows)
    }
    const p1 = await feedOf(u, '?limit=2')
    expect(p1.items.map((i) => i.name)).toEqual(['a', 'b'])
    expect(p1.nextCursor).toEqual(expect.any(String))
    const p2 = await feedOf(u, `?limit=2&before=${encodeURIComponent(p1.nextCursor ?? '')}`)
    expect(p2.items.map((i) => i.name)).toEqual(['c', 'd'])
    const p3 = await feedOf(u, `?limit=2&before=${encodeURIComponent(p2.nextCursor ?? '')}`)
    expect(p3.items.map((i) => i.name)).toEqual(['e'])
    expect(p3.nextCursor).toBeNull()
    expect((await get('/api/feed?limit=0', u.cookie)).status).toBe(400)
  })

  it('unsharing hides the card, resharing brings it back; deleting and unfriending hide it', async () => {
    const a = await signUpUser()
    const b = await signUpUser()
    await befriend(a, b)
    const w = workout(b.userId, { name: 'Toggle' })
    await pushRows(b.cookie, w.rows)
    expect(sessionIdsOf(await feedOf(a))).toEqual([w.session.id])

    await updateSession(b.cookie, w, { shareWithFriends: false })
    expect((await feedOf(a)).items).toEqual([])
    expect(await visibleTo(a, w.session.id)).toBe(404)

    await updateSession(b.cookie, w, { shareWithFriends: true })
    expect(sessionIdsOf(await feedOf(a))).toEqual([w.session.id])

    await request('DELETE', `/api/friends/${b.userId}`, a.cookie)
    expect((await feedOf(a)).items).toEqual([])
    expect(await visibleTo(a, w.session.id)).toBe(404)

    await updateSession(b.cookie, w, { deletedAt: new Date().toISOString() })
    expect((await feedOf(b)).items).toEqual([])
  })

  it('stores PRs on the feed event and refreshes them when an earlier session is edited', async () => {
    const a = await signUpUser()
    const b = await signUpUser()
    await befriend(a, b)
    const base = workout(b.userId, {
      name: 'Base',
      finishedAgoMs: 3 * DAY,
      weightKg: 100,
      exerciseId: SQUAT,
    })
    const heavy = workout(b.userId, {
      name: 'Heavy',
      finishedAgoMs: 1 * DAY,
      weightKg: 110,
      exerciseId: SQUAT,
    })
    await pushRows(b.cookie, base.rows)
    await pushRows(b.cookie, heavy.rows)

    const prsOf = async (name: string) =>
      (await feedOf(a)).items
        .find((i) => i.name === name)
        ?.prs.map((p) => p.prType)
        .sort()
    expect(await prsOf('Base')).toEqual([])
    expect(await prsOf('Heavy')).toEqual(['e1rm', 'volume', 'weight'])
    const heavyItem = (await feedOf(a)).items.find((i) => i.name === 'Heavy')
    expect(heavyItem?.prs.find((p) => p.prType === 'weight')).toMatchObject({
      exerciseName: 'Back Squat',
      value: 110,
      previous: 100,
    })

    // The old session is edited above the newer one: the newer one loses its PRs.
    await pushRows(b.cookie, [
      { table: 'sets', row: { ...base.set, weightKg: 120, updatedAt: new Date().toISOString() } },
    ])
    expect(await prsOf('Heavy')).toEqual([])
  })

  it('reactions: set, replace, remove, count, list reactors, and 404 on invisible sessions', async () => {
    const w = workout(friend.userId, { name: 'React' })
    await pushRows(friend.cookie, w.rows)
    const id = w.session.id
    const react = (u: User, emoji: string) =>
      request('PUT', `/api/sessions/${id}/reaction`, u.cookie, { emoji })

    expect((await react(me, 'fire')).status).toBe(200)
    expect((await react(friend, 'muscle')).status).toBe(200)
    expect((await react(me, 'trophy')).status).toBe(200) // replaces fire
    expect((await react(me, 'smile')).status).toBe(400)

    let item = (await feedOf(me)).items.find((i) => i.sessionId === id)
    expect(item?.reactions).toEqual({ trophy: 1, muscle: 1 })
    expect(item?.myReaction).toBe('trophy')
    const detail = (
      await json<{ session: SessionDetail }>(await get(`/api/sessions/${id}`, me.cookie))
    ).session
    expect(detail.reactions).toEqual({ trophy: 1, muscle: 1 })

    const { reactors } = await json<{ reactors: Reactor[] }>(
      await get(`/api/sessions/${id}/reactions`, me.cookie),
    )
    expect(reactors.map((r) => [r.userId, r.emoji]).sort()).toEqual(
      [
        [me.userId, 'trophy'],
        [friend.userId, 'muscle'],
      ].sort(),
    )

    expect((await request('DELETE', `/api/sessions/${id}/reaction`, me.cookie)).status).toBe(200)
    item = (await feedOf(me)).items.find((i) => i.sessionId === id)
    expect(item?.reactions).toEqual({ muscle: 1 })
    expect(item?.myReaction).toBeNull()

    // Invisible sessions: stranger, pending friend, private, unknown.
    expect((await react(stranger, 'fire')).status).toBe(404)
    expect((await react(pendingUser, 'fire')).status).toBe(404)
    expect((await request('DELETE', `/api/sessions/${id}/reaction`, stranger.cookie)).status).toBe(
      404,
    )
    expect((await get(`/api/sessions/${id}/reactions`, stranger.cookie)).status).toBe(404)
    const priv = workout(friend.userId, { shareWithFriends: false })
    await pushRows(friend.cookie, priv.rows)
    const res = await request('PUT', `/api/sessions/${priv.session.id}/reaction`, me.cookie, {
      emoji: 'fire',
    })
    expect(res.status).toBe(404)
    expect(
      (await request('PUT', `/api/sessions/${uuidv7()}/reaction`, me.cookie, { emoji: 'fire' }))
        .status,
    ).toBe(404)
  })
})
