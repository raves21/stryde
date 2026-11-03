import type {
  FeedPage,
  Friend,
  FriendRequests,
  ReactionEmoji,
  Reactor,
  SessionDetail,
  UserSearchResult,
} from '@stryde/shared'

// Social endpoints (DATA_MODEL_AND_SYNC.md §7). Online-only: plain fetches, never queued.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const parsed: unknown = await res.json().catch(() => null)
    const error =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (parsed.error as { code?: string; message?: string })
        : null
    throw new ApiError(res.status, error?.code ?? 'error', error?.message ?? 'Request failed')
  }
  return (await res.json()) as T
}

const enc = encodeURIComponent

export const socialApi = {
  feed: (before?: string) =>
    request<FeedPage>('GET', `/api/feed?limit=20${before ? `&before=${enc(before)}` : ''}`),
  session: (id: string) => request<{ session: SessionDetail }>('GET', `/api/sessions/${id}`),
  reactors: (id: string) =>
    request<{ reactors: Reactor[] }>('GET', `/api/sessions/${id}/reactions`),
  react: (id: string, emoji: ReactionEmoji) =>
    request<{ emoji: ReactionEmoji }>('PUT', `/api/sessions/${id}/reaction`, { emoji }),
  unreact: (id: string) => request<{ removed: true }>('DELETE', `/api/sessions/${id}/reaction`),

  friends: () => request<{ friends: Friend[] }>('GET', '/api/friends'),
  requests: () => request<FriendRequests>('GET', '/api/friends/requests'),
  search: (q: string) =>
    request<{ users: UserSearchResult[] }>('GET', `/api/users/search?q=${enc(q)}`),
  sendRequest: (username: string) =>
    request<{ status: 'pending' | 'accepted' }>('POST', '/api/friends/requests', { username }),
  answer: (id: string, action: 'accept' | 'decline') =>
    request<{ status: string }>('POST', `/api/friends/requests/${id}/${action}`, {}),
  removeFriend: (userId: string) => request<{ removed: true }>('DELETE', `/api/friends/${userId}`),
  mute: (userId: string, muted: boolean) =>
    request<{ muted: boolean }>(muted ? 'PUT' : 'DELETE', `/api/friends/${userId}/mute`),
}
