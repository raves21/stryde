# Phase 9 — Notifications: Web Push, SSE, Rest-Timer Push

> Release: **v2** · Depends on: Phase 8 · Next: `phase-10-vps-guide.md`
> References: `PRODUCT_SPEC.md` §4.7; `DATA_MODEL_AND_SYNC.md` §3 (push_subscriptions, notifications, scheduled_pushes), §6; `UI_DESIGN.md` §5.2 step 4, §5.13, §5.14.

## Goal
Friends get notified when you finish a shared workout; you get reactions and friend-request notifications; the rest timer alerts you even when the app is in the background (when online). Open apps update live via SSE.

## Platform facts (don't fight these)
- iOS: push works only for PWAs **added to the Home Screen** (iOS 16.4+); permission must be requested from a user tap.
- Delivery goes through the browser vendor's push service (Google/Apple/Mozilla); payloads are encrypted.
- No Notification Triggers API → background rest alerts must come from the server.

## Tasks

### 1. VAPID & config
- `pnpm gen:vapid` script (web-push `generateVAPIDKeys`).
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. `GET /api/config` exposes the public key.

### 2. Service worker (`apps/web/src/sw.ts`)
- `push`: parse payload `{ type, title, body, url, tag }` → `showNotification` with icon/badge, `tag` to collapse duplicates.
- For `rest_timer_done`: if any client is **visible** (`clients.matchAll({ type: 'window', includeUncontrolled: true })`), skip the system notification (the in-app timer already alerted).
- `notificationclick`: focus an existing window and navigate to `url`, else `clients.openWindow(url)`.
- `pushsubscriptionchange`: resubscribe and POST the new subscription.

### 3. Client subscription
- Onboarding step 4 + Settings → Notifications: "Enable notifications" button → `Notification.requestPermission()` **inside the click handler** → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → `POST /api/push/subscribe`.
- iOS not standalone → show "Add Stryde to your Home Screen first" with link to the install guide instead of the button.
- On app start (online): if permission granted but no subscription, resubscribe.
- On sign out: `DELETE /api/push/subscribe` for this endpoint, then unsubscribe.

### 4. Server notify service (`services/notify.ts`)
- `notify(userId, type, payload)`: check `user_settings` (`notificationsMuted`, per-type toggles) and friend mutes (for friend-originated types) → insert `notifications` row → send web-push to every subscription of the user → delete subscriptions on 404/410 → update `lastUsedAt`.
- Triggers:
  - `friend_workout_finished`: from the feed hook, **only if `now - finishedAt <= 60 min`**; body like "Marco finished Leg Day · 1h 12m · 2 PRs".
  - `reaction_received`: on reaction create/replace (not on remove; skip self-reactions; collapse with `tag` per session).
  - `friend_request`, `friend_accepted`.
- In-app list endpoints: `GET /api/notifications`, `POST /api/notifications/read`.

### 5. Rest-timer push
- Client hook from Phase 4 (`onRestTimerChanged`): when a rest timer starts/changes and the device is online → `POST /api/rest-timer { sessionId, fireAt }` (replaces existing); on skip/finish/discard → `DELETE /api/rest-timer`. If offline, do nothing (in-app only).
- Server scheduler: in-process interval every 5 s selects due rows in `scheduled_pushes` (not sent, not cancelled) and sends `rest_timer_done` to that user's subscriptions; marks `sentAt`. On boot, process overdue rows (send only if < 30 s late, else mark skipped).
- Respect `notifyRestTimer` and mute-all.

### 6. SSE (`GET /api/events`)
- Hono `streamSSE`; in-memory hub keyed by userId (single instance).
- Events: `sync` (own data changed on another device → client runs `syncNow()`), `feed` (invalidate feed query), `notification` (refresh bell count).
- Headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`; heartbeat comment every **25 s** (Cloudflare idle timeout ~100 s). Client uses `EventSource` with reconnect; only connects while online and the app is visible.
- Emit `sync` to the user's other devices after a push; `feed` to friends after a feed event is created/hidden; `notification` after `notify`.

### 7. UI
- Bell icon with unread dot in the top bar; `/notifications` list (icon by type, text, time ago, unread dot, "Mark all read"). Online-only.
- Settings → Notifications (`/settings/notifications`): Mute all (shadcn `Switch`, dims others), per-type switches, Muted friends list.

## Tests
- notify: respects mute-all, per-type, per-friend mutes; staleness rule; 410 deletes subscription (mock web-push).
- Scheduler: fires due timers once, ignores cancelled, handles restart.
- SSE: heartbeat sent; events routed to the right users.

## Acceptance criteria
- [ ] Android Chrome and installed iOS PWA receive friend-finished, reaction, friend-request and rest-timer notifications.
- [ ] Rest-timer notification appears with the app backgrounded/locked (online), and not twice when the app is open.
- [ ] Muting works; workouts synced > 60 min after finishing don't notify.
- [ ] All checks green.
