# Phase 6 — PWA Hardening & Offline Polish

> Release: **v1** · Depends on: Phase 5 · Next: `phase-07-docker-cicd.md`
> References: `PRODUCT_SPEC.md` §5, `UI_DESIGN.md` §3 (sync indicator), §5.2, §5.14, §7.

## Goal
Stryde installs like a native app on Android and iOS, cold-starts with no network, and updates safely.

## Tasks

### 1. Service worker (vite-plugin-pwa, `injectManifest`)
- Custom `apps/web/src/sw.ts` (needed later for push handlers in Phase 9).
- Precache: app shell, JS/CSS chunks, fonts (fontsource files), icons.
- Navigation requests → `index.html` (SPA fallback). **Denylist `/api/*`**; the SW never caches API responses.
- Social screens need no caching (online-only by design).

### 2. Manifest & icons
- `name: "Stryde"`, `short_name: "Stryde"`, `display: standalone`, `orientation: portrait`, `start_url: /`, `background_color` and `theme_color` = `--bg`.
- Icons 192, 512, maskable 512; `apple-touch-icon` 180; iOS meta tags (`apple-mobile-web-app-capable`, status bar style `black-translucent`); splash-friendly background.

### 3. Update flow
- New SW waits (`registerType: 'prompt'`).
- Show a Sonner toast "Update available — Reload".
- **Never reload while a workout is active**: if active, defer the toast until the workout is finished.

### 4. Install guide (`/settings/install` + onboarding step)
- Detect standalone (`display-mode: standalone` / `navigator.standalone`).
- Android/Chromium: capture `beforeinstallprompt` → "Install" button.
- iOS Safari: step-by-step "Share → Add to Home Screen" with icons.

### 5. Offline UX pass
- `SyncIndicator` states final (synced / syncing / offline + N pending / error) with the explanatory sheet.
- Settings → Sync & data (`/settings/sync`): status, last synced, pending count, "Sync now", list of `syncErrors` if any.
- Social placeholders/screens show the offline state.
- Sign out flow: shadcn `AlertDialog` warning when the outbox is non-empty.

### 6. Profile & settings screens (v1 scope)
- `/profile` hub per `UI_DESIGN.md` §5.14: avatar (initials fallback; upload can be added later), display name, username, Workout settings (units, default rest, keep screen on, share default), Sync & data, App (install guide, version = git SHA from `/api/health` or build-time constant), Sign out.

### 7. Audit
- Lighthouse: installable, no console errors, good performance on mobile.
- Check `prefers-reduced-motion`, safe areas on notched iPhones, 130% text size.

## Tests
- Playwright: load app online once → `context.setOffline(true)` → reload → app shell + Today screen render; log and finish a workout; go online → syncs.

## Acceptance criteria
- [ ] Installable on Android (Chrome) and iOS (Safari Add to Home Screen).
- [ ] Cold start offline works after first load.
- [ ] Update prompt never interrupts an active workout.
- [ ] All checks green.
