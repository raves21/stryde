import { useSyncExternalStore } from 'react'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export type SyncState = {
  /** False until the controller has read `lastSyncAt` from the local DB. */
  ready: boolean
  status: SyncStatus
  lastSyncAt: string | null
  error: string | null
}

const initial: SyncState = { ready: false, status: 'idle', lastSyncAt: null, error: null }
let state = initial
const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return state
}

export function setSyncState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function resetSyncState() {
  state = initial
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState)
}
