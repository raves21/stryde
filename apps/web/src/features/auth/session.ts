import { clearCurrentUser, clearLocalData, getCurrentUser, setCurrentUser } from '@/db/meta'
import { fetchMe, type Me } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { stopSync } from '@/sync/controller'

/**
 * Who is signed in, for the route guard. A cached user wins so the app opens
 * offline; only without a cache do we ask the server (e.g. right after the
 * Google OAuth redirect).
 */
export async function resolveSession(): Promise<Me | null> {
  const cached = await getCurrentUser()
  if (cached) return cached
  if (!navigator.onLine) return null
  const result = await fetchMe()
  if (result.status !== 'ok') return null
  await setCurrentUser(result.me)
  return result.me
}

export type Revalidation = 'unchanged' | 'updated' | 'signed-out' | 'offline'

/**
 * Background check against the server. A 401 forgets the session but keeps all
 * other local data (unsynced changes survive, Phase 2).
 */
export async function revalidateSession(): Promise<Revalidation> {
  const result = await fetchMe()
  if (result.status === 'offline') return 'offline'
  if (result.status === 'unauthorized') {
    await clearCurrentUser()
    return 'signed-out'
  }
  const cached = await getCurrentUser()
  await setCurrentUser(result.me)
  return JSON.stringify(cached) === JSON.stringify(result.me) ? 'unchanged' : 'updated'
}

/** After a successful sign-in/sign-up: cache the user. */
export async function completeSignIn(): Promise<Me> {
  const result = await fetchMe()
  if (result.status !== 'ok') throw new Error('Signed in, but loading your account failed')
  await setCurrentUser(result.me)
  return result.me
}

/** The sync engine got a 401: forget the session, keep the outbox for the same user. */
export async function forgetSession(): Promise<void> {
  await clearCurrentUser()
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
  // A pull finishing after the wipe would leave rows without an owner.
  await stopSync()
  await clearLocalData()
}
