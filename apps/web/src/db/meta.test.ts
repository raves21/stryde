import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Me } from '@/lib/api'
import { StrydeDb } from './db'
import {
  clearCurrentUser,
  getCurrentUser,
  getPendingUnit,
  setCurrentUser,
  setPendingUnit,
} from './meta'

function me(id: string, username: string | null = 'juandc'): Me {
  return {
    user: {
      id,
      email: `${id}@example.com`,
      username,
      displayName: 'Juan Dela Cruz',
      avatarUrl: null,
      createdAt: '2026-10-24T00:00:00.000Z',
    },
    settings: { unit: 'kg', defaultRestSeconds: 120 },
    needsOnboarding: username === null,
  }
}

let n = 0
function freshDb() {
  n += 1
  return new StrydeDb(`test-${n}`)
}

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
    await setPendingUnit('lb', db)
    await setCurrentUser(me('a'), db)
    expect(await getPendingUnit(db)).toBe('lb')
  })

  it('clears local data when a different user signs in', async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setPendingUnit('lb', db)
    await setCurrentUser(me('b'), db)
    expect(await getPendingUnit(db)).toBeNull()
    expect((await getCurrentUser(db))?.user.id).toBe('b')
  })

  it('clearCurrentUser removes only the session', async () => {
    db = freshDb()
    await setCurrentUser(me('a'), db)
    await setPendingUnit('kg', db)
    await clearCurrentUser(db)
    expect(await getCurrentUser(db)).toBeNull()
    expect(await getPendingUnit(db)).toBe('kg')
  })
})
