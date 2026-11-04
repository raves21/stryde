/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Service worker (vite-plugin-pwa `injectManifest`): precache the app shell so it starts
// offline, and show Web Push notifications (Phase 9).

declare let self: ServiceWorkerGlobalScope

// Injected at build time: index.html, JS/CSS chunks, fonts, icons.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigations get index.html. API calls are never handled or cached here; own data
// lives in IndexedDB, and social data is online-only by design.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
)

// A new version waits until the app asks (the "Update available" toast), which it never
// does during an active workout (AGENTS.md hard rule 11).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
clientsClaim()

// ---- Web Push (plan/phase-09 §2) ----

type PushPayload = { type: string; title: string; body: string; url: string; tag: string }

function readPayload(event: PushEvent): PushPayload | null {
  try {
    const data = event.data?.json() as Partial<PushPayload> | undefined
    if (!data?.title) return null
    return {
      type: data.type ?? '',
      title: data.title,
      body: data.body ?? '',
      url: data.url ?? '/',
      tag: data.tag ?? 'stryde',
    }
  } catch {
    return null
  }
}

const isIos = () => /iphone|ipad|ipod/i.test(self.navigator.userAgent)

self.addEventListener('push', (event) => {
  const payload = readPayload(event)
  if (!payload) return
  event.waitUntil(
    (async () => {
      // The in-app timer already alerted a visible app, so the system banner is noise.
      let quiet = false
      if (payload.type === 'rest_timer_done') {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        quiet = windows.some((w) => w.visibilityState === 'visible')
      }
      // Safari revokes subscriptions whose pushes show nothing, so on iOS the banner is
      // shown and closed again instead of skipped.
      if (quiet && !isIos()) return
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: payload.url },
      })
      if (quiet) {
        const shown = await self.registration.getNotifications({ tag: payload.tag })
        for (const n of shown) n.close()
      }
    })(),
  )
})

// Tap: focus the open app and let it route in place (a reload mid-workout is never wanted),
// or open a new window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String((event.notification.data as { url?: string } | null)?.url ?? '/')
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) {
        open.postMessage({ type: 'NAVIGATE', url })
        await open.focus()
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})

// The browser rotated the subscription: store the new one so pushes keep arriving.
self.addEventListener('pushsubscriptionchange', (event) => {
  const change = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null
    newSubscription?: PushSubscription | null
  }
  change.waitUntil(
    (async () => {
      const key = change.oldSubscription?.options.applicationServerKey
      const subscription =
        change.newSubscription ??
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          ...(key ? { applicationServerKey: key } : {}),
        }))
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
    })(),
  )
})
