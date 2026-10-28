/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// Service worker (vite-plugin-pwa `injectManifest`): precache the app shell so it starts
// offline. Push and notificationclick handlers arrive in Phase 9.

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
