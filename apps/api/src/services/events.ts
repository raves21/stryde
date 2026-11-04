import type { ServerEvent } from '@stryde/shared'

// In-process pub/sub for `GET /api/events` (SSE). One instance only (CLAUDE.md), so a
// plain Map keyed by user id is enough; nothing here is persisted.

type Listener = (event: ServerEvent) => void

const listeners = new Map<string, Set<Listener>>()

/** Listen for a user's events; returns the unsubscribe function. */
export function subscribe(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId)
  if (!set) {
    set = new Set()
    listeners.set(userId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(userId)
  }
}

/** Send an event to every open connection of the given users. */
export function publish(userIds: string | string[], event: ServerEvent): void {
  for (const id of Array.isArray(userIds) ? userIds : [userIds]) {
    for (const listener of listeners.get(id) ?? []) {
      try {
        listener(event)
      } catch (error) {
        console.error('sse listener failed', error)
      }
    }
  }
}

export const connectionCount = (userId: string) => listeners.get(userId)?.size ?? 0
