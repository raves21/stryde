import { afterEach, describe, expect, it } from 'vitest'
import { freshDb, me } from '@/test/local-db'
import type { StrydeDb } from './db'
import {
  clearCurrentUser,
  getCurrentUser,
  getMeta,
  getOwner,
  setCurrentUser,
  setMeta,
} from './meta'

describe('meta: current user', () => {
  let db: StrydeDb
  afterEach(async () => {
    await db.delete()
  })

  it('caches and reads the current user', async () => {
    db = freshDb()
    expect(await getCurrentUser(db)).toBeNull()
    await setCurrentUser(me('a'), db)
    expect((await getCurrentUser(db))?.user.id).toBe('a')
  })

  it('keeps local data when the same user signs in again', async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setMeta('marker', 'lb', db)
    await setCurrentUser(me('a'), db)
    expect(await getMeta('marker', db)).toBe('lb')
  })

  it('clears local data when a different user signs in', async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setMeta('marker', 'lb', db)
    await setCurrentUser(me('b'), db)
    expect(await getMeta('marker', db)).toBeUndefined()
    expect((await getCurrentUser(db))?.user.id).toBe('b')
  })

  it('clearCurrentUser removes only the session', async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setMeta('marker', 'kg', db)
    await clearCurrentUser(db)
    expect(await getCurrentUser(db)).toBeNull()
    expect(await getMeta('marker', db)).toBe('kg')
    expect(await getOwner(db)).toEqual({ id: 'a', username: 'juandc' })
  })

  it("clears the previous owner's data after a 401 when someone else signs in", async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setMeta('marker', 'kg', db)
    await clearCurrentUser(db)
    await setCurrentUser(me('b', 'other'), db)
    expect(await getMeta('marker', db)).toBeUndefined()
    expect(await getOwner(db)).toEqual({ id: 'b', username: 'other' })
  })
})
