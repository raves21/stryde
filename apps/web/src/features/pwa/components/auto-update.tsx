import { useRegisterSW } from 'virtual:pwa-register/react'
import { useCallback, useEffect, useRef } from 'react'
import { useActiveSession } from '@/features/workout/use-workout'
import { hasUnsavedWork } from '@/lib/unsaved-work'
import { APPLY_DELAY_MS, shouldApplyUpdate } from '../auto-update'

const HOUR = 60 * 60 * 1000
const CHECK_ON_RETURN_MS = 10 * 60 * 1000

/**
 * Keeps the app up to date without asking. The browser downloads a new version in the
 * background (checked hourly, and when you come back to the app); this applies it, which
 * reloads the page, but only when nothing is in progress (`shouldApplyUpdate`): shortly
 * after you leave the app, or when you return after a longer absence. Otherwise it waits,
 * and a version that is never applied this way still takes over the next time the app is
 * closed and reopened.
 */
export function AutoUpdate() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const lastCheck = useRef(Date.now())
  const tryApplyRef = useRef<(hiddenForMs: number) => void>(() => {})
  /** The new version has taken over but the page still runs the old one. */
  const reloadPending = useRef(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registered) {
      if (!registered) return
      registration.current = registered
      setInterval(() => void registered.update(), HOUR)
    },
    // The library would reload the moment the new version takes over, whatever you are doing.
    // Hold the reload until it is safe, like the activation itself.
    onNeedReload() {
      reloadPending.current = true
      tryApplyRef.current(0)
    },
  })
  const active = useActiveSession()

  const latest = useRef({ needRefresh, active, updateServiceWorker })
  latest.current = { needRefresh, active, updateServiceWorker }
  const applying = useRef(false)
  const hiddenAt = useRef<number | null>(document.hidden ? Date.now() : null)

  const tryApply = useCallback((hiddenForMs: number) => {
    const { needRefresh: waiting, active: session, updateServiceWorker: apply } = latest.current
    const go = shouldApplyUpdate({
      waiting: waiting || reloadPending.current,
      workoutActive: session === undefined ? undefined : session !== null,
      unsavedWork: hasUnsavedWork(),
      pathname: window.location.pathname,
      hidden: document.hidden,
      hiddenForMs,
    })
    if (!go) return
    if (reloadPending.current) {
      window.location.reload()
      return
    }
    if (applying.current) return
    applying.current = true
    void apply(true)
  }, [])
  tryApplyRef.current = tryApply

  // The update (or the end of a workout) can arrive while the app is already in the background.
  useEffect(() => {
    if (needRefresh && active !== undefined && document.hidden) tryApply(0)
  }, [needRefresh, active, tryApply])

  useEffect(() => {
    let leaving: ReturnType<typeof setTimeout> | undefined
    function onVisibility() {
      clearTimeout(leaving)
      if (document.hidden) {
        hiddenAt.current = Date.now()
        // Not in the same instant as the app is hidden, see APPLY_DELAY_MS.
        leaving = setTimeout(() => tryApply(0), APPLY_DELAY_MS)
        return
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current
      hiddenAt.current = null
      tryApply(away)
      // Timers don't run while a phone app is suspended, so look for a new version on return.
      if (Date.now() - lastCheck.current > CHECK_ON_RETURN_MS) {
        lastCheck.current = Date.now()
        void registration.current?.update()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(leaving)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [tryApply])

  return null
}
