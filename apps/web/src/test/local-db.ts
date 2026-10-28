import { StrydeDb } from '@/db/db'
import { setCurrentUser } from '@/db/meta'
import type { Me } from '@/lib/api'

export function me(id: string, username: string | null = 'juandc'): Me {
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
/** A fresh, uniquely named Dexie database (fake-indexeddb). */
export function freshDb(): StrydeDb {
  n += 1
  return new StrydeDb(`test-${n}-${Date.now()}`)
}

/** A fresh database owned by `userId`, as after sign-in. */
export async function signedInDb(userId: string): Promise<StrydeDb> {
  const db = freshDb()
  await setCurrentUser(me(userId), db)
  return db
}
