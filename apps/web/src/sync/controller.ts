import { db as defaultDb } from '@/db/db'
import { getMeta } from '@/db/meta'
import { onLocalWrite } from '@/db/repositories/core'
import { createSyncEngine, META_LAST_SYNC_AT } from './engine'
import { resetSyncState, setSyncState } from './status'
import { httpTransport } from './transport'

// When to sync (DATA_MODEL_AND_SYNC.md §5): start, `online`, tab visible, 2 s after
// local writes, every 60 s while visible, and with backoff after failures.

const WRITE_DEBOUNCE_MS = 2000
const POLL_MS = 60_000
const BACKOFF_START_MS = 2000
const BACKOFF_MAX_MS = 60_000

let requestSyncImpl: (() => void) | null = null
let stopActive: (() => Promise<void>) | null = null

/** Sync as soon as possible (e.g. after finishing a workout, or a Retry button). */
export function requestSync() {
  requestSyncImpl?.()
}

/** Stop syncing and wait for a run in progress (before wiping the local DB). */
export async function stopSync() {
  await stopActive?.()
}

/** Starts syncing for the signed-in user; returns a stop function. */
export function startSyncController({ onUnauthorized }: { onUnauthorized: () => void }) {
  const db = defaultDb
  const engine = createSyncEngine({
    db,
    transport: httpTransport(),
    // Only one tab syncs at a time.
    lock: (fn) =>
      typeof navigator.locks?.request === 'function'
        ? navigator.locks.request('stryde-sync', fn)
        : fn(),
  })
  let stopped = false
  let backoff = BACKOFF_START_MS
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<unknown> = Promise.resolve()

  async function run() {
    if (stopped) return
    clearTimeout(retryTimer)
    if (!navigator.onLine) {
      setSyncState({ status: 'offline' })
      return
    }
    setSyncState({ status: 'syncing' })
    const pending = engine.syncNow()
    inFlight = pending
    const result = await pending
    if (stopped) return
    switch (result.status) {
      case 'ok':
        backoff = BACKOFF_START_MS
        setSyncState({
          status: 'idle',
          error: null,
          lastSyncAt: (await getMeta<string>(META_LAST_SYNC_AT, db)) ?? null,
        })
        return
      case 'unauthorized':
        setSyncState({ status: 'idle' })
        onUnauthorized()
        return
      case 'offline':
        setSyncState({ status: 'offline' })
        break
      case 'error':
        setSyncState({ status: 'error', error: result.message })
        break
    }
    retryTimer = setTimeout(run, backoff)
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
  }

  const onOnline = () => {
    backoff = BACKOFF_START_MS
    void run()
  }
  const onOffline = () => setSyncState({ status: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') void run()
  }
  const poll = setInterval(() => {
    if (document.visibilityState === 'visible') void run()
  }, POLL_MS)
  const stopWrites = onLocalWrite(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(run, WRITE_DEBOUNCE_MS)
  })

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  requestSyncImpl = () => void run()

  // Ask the browser not to evict our IndexedDB (unsynced workouts live there).
  void navigator.storage?.persist?.()

  void getMeta<string>(META_LAST_SYNC_AT, db).then((lastSyncAt) => {
    if (stopped) return
    setSyncState({ ready: true, lastSyncAt: lastSyncAt ?? null })
    void run()
  })

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    clearTimeout(debounceTimer)
    clearInterval(poll)
    stopWrites()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    requestSyncImpl = null
    stopActive = null
    resetSyncState()
  }
  stopActive = async () => {
    stop()
    await inFlight
  }
  return stop
}
