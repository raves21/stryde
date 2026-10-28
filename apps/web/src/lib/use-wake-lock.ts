import { useEffect } from 'react'

/**
 * Keep the screen on while `enabled` (active workout screen). The browser drops the lock
 * when the page is hidden, so it's re-acquired on `visibilitychange`.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    async function acquire() {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) await lock.release()
        lock?.addEventListener('release', () => {
          lock = null
        })
      } catch {
        // Denied (e.g. battery saver): the workout still works, the screen may dim.
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release()
    }
  }, [enabled])
}
