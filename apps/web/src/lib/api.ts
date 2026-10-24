// Thin fetch helpers for own-account endpoints. Synced data never goes through
// here (that's the sync engine, Phase 2).

export type Me = {
  user: {
    id: string
    email: string
    username: string | null
    displayName: string
    avatarUrl: string | null
    createdAt: string
  }
  settings: { unit: 'kg' | 'lb'; defaultRestSeconds: number; [key: string]: unknown }
  needsOnboarding: boolean
}

export type MeResult = { status: 'ok'; me: Me } | { status: 'unauthorized' } | { status: 'offline' }

export async function fetchMe(): Promise<MeResult> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    if (res.status === 401) return { status: 'unauthorized' }
    if (!res.ok) return { status: 'offline' }
    return { status: 'ok', me: (await res.json()) as Me }
  } catch {
    // Network failure: treat like offline, never as signed out.
    return { status: 'offline' }
  }
}

export type UsernameCheck = { username: string; available: boolean; valid: boolean }

export async function checkUsername(u: string, signal?: AbortSignal): Promise<UsernameCheck> {
  const res = await fetch(`/api/users/username-available?u=${encodeURIComponent(u)}`, { signal })
  return (await res.json()) as UsernameCheck
}
