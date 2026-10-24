# Data Model & Offline Sync Protocol

> Read `PRODUCT_SPEC.md` first. This doc is normative: the Postgres schema (Drizzle), the client IndexedDB schema (Dexie), and the sync API must match it. If you need to deviate, update this doc in the same change.

---

## 1. Principles

1. **The client's local DB is the source of truth for the UI.** Screens read from Dexie (`useLiveQuery`) and write to Dexie. They never wait on the network for the user's own data.
2. **Every user writes only their own rows.** Friends only *read*. So conflicts only happen between the *same user's* devices → **row-level last-write-wins (LWW)** is sufficient.
3. **IDs are generated on the client** as **UUIDv7** (time-sortable). No ID remapping after sync.
4. **Nothing is hard-deleted** in synced tables. Deletes set `deletedAt` (tombstone).
5. **The server assigns a monotonically increasing `serverVersion`** to every write; clients pull with a cursor.
6. All timestamps are UTC ISO strings / `timestamptz`, except `localDate` (a plain `YYYY-MM-DD` in the user's timezone at session start).
7. Weight stored in **kg** (`numeric(7,2)`), converted for display only.

---

## 2. Synced tables (user-owned)

Common columns on every synced table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (v7) | client-generated PK |
| `userId` | uuid | owner; server **overwrites** with the authenticated user id on push |
| `createdAt` | timestamptz | client time |
| `updatedAt` | timestamptz | client time of last local change → LWW comparator |
| `deletedAt` | timestamptz null | tombstone |
| `serverVersion` | bigint | server-only; set from a global sequence on every insert/update |

### `exercises`
| Column | Type | Notes |
|---|---|---|
| `name` | text | |
| `type` | enum `weighted \| bodyweight \| timed` | |
| `muscleGroup` | enum (chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core, full_body, cardio, other) | |
| `equipment` | enum (barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, smith, other) | |
| `defaultRestSeconds` | int null | |
| `isPreset` | bool | preset rows have `userId = null`, are seeded server-side, read-only |

Presets are delivered via pull like any row (with `userId null`), cached locally, never pushed.

### `templates`
`name` text, `notes` text null, `sortOrder` int.

### `template_exercises`
`templateId` → templates, `exerciseId` → exercises, `position` int, `supersetGroup` text null (e.g. `"A"`; same value = same superset), `restSeconds` int null.

### `template_sets`
`templateExerciseId`, `position` int, `setType` enum `warmup|working`, `targetKind` enum `fixed|rir|failure`, `targetReps` int null, `targetRepsMax` int null (rep range), `targetRir` int null, `plannedWeightKg` numeric null, `plannedDurationSec` int null.

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `templateId` | uuid null | origin template |
| `name` | text | copied from template or "Workout" / user-entered |
| `startedAt` | timestamptz | |
| `finishedAt` | timestamptz null | null = active |
| `timezone` | text | IANA tz at start, e.g. `Asia/Manila` |
| `localDate` | date | date of `startedAt` in `timezone` → calendar day |
| `notes` | text null | |
| `shareWithFriends` | bool | default from user settings |

Constraint (enforced client-side, sanity-checked server-side): at most one session per user with `finishedAt IS NULL AND deletedAt IS NULL`.

### `session_exercises`
`sessionId`, `exerciseId`, `position` int, `supersetGroup` text null, `restSeconds` int null.

### `sets`
| Column | Type | Notes |
|---|---|---|
| `sessionExerciseId` | uuid | |
| `position` | int | |
| `setType` | `warmup \| working` | |
| `targetKind` | `fixed \| rir \| failure` | |
| `targetReps`, `targetRepsMax`, `targetRir` | int null | copied from template |
| `weightKg` | numeric null | weight, or *added* weight for bodyweight |
| `reps` | int null | actual reps |
| `rir` | int null | actual RIR; `0` for failure sets |
| `durationSec` | int null | timed exercises |
| `completedAt` | timestamptz null | null = not done. Only completed sets count anywhere. |

Validation (shared Zod): a set can only have `completedAt` set if the required actuals for its exercise type exist (`reps` for weighted/bodyweight, `durationSec` for timed), and for `rir` sets `rir` is non-null.

### `user_settings` (one row per user, `id = userId`)
`unit` (`kg|lb`, default `kg`), `defaultRestSeconds` (default 120), `defaultShareWithFriends` (default true), `notificationsMuted` bool, `notifyFriendWorkouts`, `notifyReactions`, `notifyFriendRequests`, `notifyRestTimer` bools (default true).

---

## 3. Server-only tables (not in the sync stream)

| Table | Purpose |
|---|---|
| Better Auth tables (`user`, `session`, `account`, `verification`) | auth. `user` gets an extra `username` column (unique, from Better Auth's username plugin). Display name and avatar use Better Auth's built-in `name` and `image` columns; the API exposes them as `displayName` / `avatarUrl`. IDs are UUIDs. |
| `friendships` | `id`, `requesterId`, `addresseeId`, `status` (`pending\|accepted\|declined`), timestamps. Unique on unordered pair. |
| `friend_mutes` | `userId`, `mutedUserId` |
| `reactions` | `id`, `userId` (reactor), `sessionId`, `emoji` enum `muscle\|fire\|clap\|trophy\|grimace`, `createdAt`. Unique `(userId, sessionId)`. **Online-only, not synced**; hard delete is fine here. Server rejects reactions to sessions the user can't see. |
| `feed_events` | `id`, `userId` (actor), `sessionId` (unique), `createdAt` (= session `finishedAt`), `prs` jsonb (PR summary), `hidden` bool |
| `personal_records` | `id`, `userId`, `exerciseId`, `prType`, `value` numeric, `setId`, `sessionId`, `achievedAt`. Recomputed per exercise when that exercise's sessions change. |
| `push_subscriptions` | `id`, `userId`, `endpoint` (unique), `p256dh`, `auth`, `userAgent`, `createdAt`, `lastUsedAt` |
| `notifications` | in-app list: `id`, `userId`, `type`, `payload` jsonb, `readAt`, `createdAt` |
| `scheduled_pushes` | rest-timer pushes: `id`, `userId`, `sessionId`, `fireAt`, `sentAt`, `cancelledAt` |

---

## 4. Client (Dexie) schema

Same synced tables, same field names (camelCase), plus:

```ts
// apps/web/src/db/schema.ts (illustrative)
db.version(1).stores({
  exercises:         'id, userId, name, muscleGroup, deletedAt',
  templates:         'id, sortOrder, deletedAt',
  templateExercises: 'id, templateId, [templateId+position]',
  templateSets:      'id, templateExerciseId, [templateExerciseId+position]',
  sessions:          'id, localDate, startedAt, finishedAt, deletedAt',
  sessionExercises:  'id, sessionId, exerciseId, [sessionId+position]',
  sets:              'id, sessionExerciseId, [sessionExerciseId+position], completedAt',
  userSettings:      'id',
  outbox:            '++seq, table, rowId',      // pending mutations
  meta:              'key',                      // syncCursor, lastSyncAt, currentUserId, ...
});
```

- Every repository write is **one Dexie transaction** that (a) writes the row with a new `updatedAt`, and (b) appends to `outbox`. Never write a synced table without an outbox entry.
- Outbox entries are **coalesced** per row: if a row already has a pending entry, replace it with the latest full row snapshot (keeps the queue small during rapid set edits).
- Local derived data (PRs, chart series) is computed from Dexie with the shared calculation module; not stored.
- On sign-out: if outbox non-empty, warn. On confirm, clear the whole DB. On sign-in as a different user, clear the whole DB.

---

## 5. Sync API

All endpoints require auth (session cookie). JSON. Validated with shared Zod schemas.

### `POST /api/sync/push`
```jsonc
// request
{
  "clientId": "uuid-of-this-device-install",
  "mutations": [
    { "table": "sessions", "row": { /* full row incl. id, updatedAt, deletedAt */ } },
    { "table": "sets", "row": { ... } }
  ]
}
// response
{
  "results": [ { "table": "sessions", "id": "...", "status": "applied" | "ignored_stale" | "rejected", "error": "..." } ]
}
```

Server algorithm (one transaction):
1. `SELECT pg_advisory_xact_lock(hashtext(userId))` — serializes pushes per user (prevents version-ordering gaps between a user's own devices).
2. For each mutation, in order:
   - Validate with the table's Zod schema; force `userId = auth user`. Preset exercises → reject.
   - Ownership: referenced parents (e.g. `sessionExerciseId`) must belong to the user (or be a preset exercise).
   - Upsert **only if** incoming `updatedAt >= existing.updatedAt` (else `ignored_stale`).
   - Trigger sets `serverVersion = nextval('sync_version_seq')`.
3. Foreign keys are `DEFERRABLE INITIALLY DEFERRED` so a batch can contain parent and child in any order.
4. After commit, run **side effects** (see §6) for affected sessions/exercises.

Client sends mutations in outbox order, batches of ≤ 200. Removes outbox entries only for `applied` / `ignored_stale`. `rejected` entries are moved to a `syncErrors` list shown in Settings → Sync (should never happen in practice; log it).

### `GET /api/sync/pull?cursor=<serverVersion>&limit=1000`
Returns all rows of the user's own synced tables **and preset exercises** with `serverVersion > cursor`, ordered by `serverVersion`:
```jsonc
{ "changes": [ { "table": "sets", "row": { ... } } ], "cursor": "12345", "hasMore": false }
```
Client applies each row with LWW (`incoming.updatedAt >= local.updatedAt`, and **skip rows that have a pending outbox entry** — local pending change wins until pushed), then stores the cursor. Loop while `hasMore`.

### Sync loop (client)
`syncNow()` = push all → pull until done. Single-flight (never two concurrent runs). Triggered by:
- app start, `online` event, `visibilitychange → visible`
- after any local write, debounced 2 s (only if online)
- after finishing a session (immediately)
- SSE `sync` hint (v2), every 60 s while visible

Retry with exponential backoff on network errors. A `401` stops the loop and routes to login **without clearing the outbox**.

### Initial sync
New device: pull from cursor `0`. Show a "Downloading your data" state on first login.

---

## 6. Server side effects after push

For each session touched in the push:
1. If `finishedAt` set, not deleted, `shareWithFriends = true`, and no feed event exists → create `feed_events` row (`createdAt = finishedAt`).
   - If `now - finishedAt <= 60 min` → enqueue `friend_workout_finished` notifications to accepted friends, honoring mutes and settings.
2. If `shareWithFriends` became false or session deleted → set `feed_events.hidden = true`.
3. If it became true again → `hidden = false` (no notification).
4. Recompute `personal_records` for every exercise touched (using `packages/shared` calc module), update `feed_events.prs`.
5. Publish an SSE `sync` hint to the user's other connected devices, and `feed` hint to friends (v2).

Session finished then edited → feed details are read live, so edits show automatically.

---

## 7. Social endpoints (online-only; not via sync, not persisted on the client)

Social data is fetched with TanStack Query using the default **in-memory** cache only (no IndexedDB persister). When offline, social queries don't run and screens show an offline state. Social actions (reactions, friend requests) are plain API calls with optimistic UI that rolls back on failure; they are **not** queued in the outbox.

| Endpoint | Returns |
|---|---|
| `GET /api/feed?before=<cursor>&limit=20` | feed events of self + accepted friends, non-hidden, with actor profile, session name, duration, counts, PRs, reaction counts, my reaction |
| `GET /api/sessions/:id` | full session detail if owner or (friend and shared) — includes exercise names (also for friends' custom exercises) |
| `GET /api/sessions/:id/reactions` | list of reactors |
| `PUT /api/sessions/:id/reaction` `{ emoji }`, `DELETE /api/sessions/:id/reaction` | set/replace or remove my reaction |
| `GET /api/friends`, `GET /api/friends/requests` | lists |
| `POST /api/friends/requests` `{ username }` | send |
| `POST /api/friends/requests/:id/accept` / `decline`, `DELETE /api/friends/:userId` | |
| `PUT/DELETE /api/friends/:userId/mute` | |
| `GET /api/users/search?q=` | exact/prefix username match, max 10 |
| `GET /api/notifications`, `POST /api/notifications/read` | in-app list |
| `POST /api/push/subscribe`, `DELETE /api/push/subscribe` | Web Push subscriptions |
| `POST /api/rest-timer` `{ sessionId, fireAt }`, `DELETE /api/rest-timer` | schedule/cancel rest push |
| `GET /api/events` | SSE stream |

---

## 8. Edge cases checklist (write tests for these)
- Same set edited on two devices offline → later `updatedAt` wins on both after sync.
- Session deleted on device A while device B adds sets → session stays deleted; orphan sets are tombstoned server-side when parent is tombstoned (cascade tombstone in push transaction).
- Push contains child before parent → succeeds (deferred FKs).
- Same mutation pushed twice (retry after timeout) → idempotent.
- Workout finished offline, synced 3 h later → feed event with correct time, **no push**.
- Share toggled off after finishing → feed event hidden; on again → visible, no push.
- Editing an old session lowers a PR → PR recomputed.
- Clock skew: client clocks may be wrong; LWW uses client `updatedAt` but server clamps `updatedAt` to at most `now + 5 min`.
- User signs out with pending outbox → warning shown.
- Two active sessions created offline on two devices → after sync, client detects >1 active session and asks the user which to keep (the other gets finished or discarded by choice).
