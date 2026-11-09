import { useEffect } from 'react'

// Screens with edits that exist only in memory (the template editor's draft, an open exercise
// form) tell the app, so an automatic update never reloads them away (features/pwa/auto-update).

const holders = new Set<symbol>()

export const hasUnsavedWork = () => holders.size > 0

/** Mark the screen as holding unsaved work while `active`. */
export function useUnsavedWork(active: boolean) {
  useEffect(() => {
    if (!active) return
    const holder = Symbol('unsaved-work')
    holders.add(holder)
    return () => {
      holders.delete(holder)
    }
  }, [active])
}
