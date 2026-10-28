import { useSyncExternalStore } from 'react'

// Install support (UI_DESIGN.md §5.2): Chromium's `beforeinstallprompt`, iOS detection
// (Safari has no prompt, only "Add to Home Screen"), and standalone detection.

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => {
  for (const l of listeners) l()
}

/** Call once at startup: the event fires early and only once per page load. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

export function isStandalone(): boolean {
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type Platform = 'ios' | 'android' | 'other'

export function platform(): Platform {
  const ua = navigator.userAgent
  // iPadOS reports as Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether the browser offered an install prompt, and a way to show it. */
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null)
  const standalone = useSyncExternalStore(subscribe, isStandalone)
  return {
    canPrompt,
    standalone,
    async prompt(): Promise<boolean> {
      const event = deferred
      if (!event) return false
      await event.prompt()
      const { outcome } = await event.userChoice
      deferred = null
      notify()
      return outcome === 'accepted'
    },
  }
}
