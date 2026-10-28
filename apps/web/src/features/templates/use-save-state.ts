import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export type SaveState = 'idle' | 'pending' | 'saved'

/**
 * Autosave bookkeeping for the editor: `save(fn)` writes now, `saveLater(key, fn)`
 * debounces per field. The state drives the "Saving… / Saved" label; local writes
 * are instant, so "pending" only covers the debounce.
 */
export function useSaveState(delayMs = 500) {
  const [state, setState] = useState<SaveState>('idle')
  const timers = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; fn: () => Promise<unknown> }>(),
  )

  const save = useCallback(async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      if (timers.current.size === 0) setState('saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    }
  }, [])

  const saveLater = useCallback(
    (key: string, fn: () => Promise<unknown>) => {
      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing.timer)
      setState('pending')
      const timer = setTimeout(() => {
        timers.current.delete(key)
        void save(fn)
      }, delayMs)
      timers.current.set(key, { timer, fn })
    },
    [delayMs, save],
  )

  /** Write all debounced edits now (before actions that read them back). */
  const flush = useCallback(async () => {
    const pending = [...timers.current.values()]
    timers.current.clear()
    for (const { timer } of pending) clearTimeout(timer)
    await Promise.all(pending.map(({ fn }) => save(fn)))
  }, [save])

  // Leaving the screen flushes pending edits instead of dropping them.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const { timer, fn } of pending.values()) {
        clearTimeout(timer)
        void fn().catch(() => {})
      }
      pending.clear()
    }
  }, [])

  return { state, save, saveLater, flush }
}
