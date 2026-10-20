# Phase 2 — Local DB & Sync Engine

> Release: **v1** · Depends on: Phase 1 · Next: `phase-03-exercises-templates.md`
> **Most important phase. Test heavily.** Normative reference: `DATA_MODEL_AND_SYNC.md` (all of it).

## Goal
The client has a complete local database with an outbox; the server exposes push/pull; two devices of the same user converge after offline edits. No UI features yet beyond a sync status indicator.

## Tasks

### 1. Shared Zod schemas (`packages/shared/src/schemas/`)
- One schema per synced table (row shape exactly as in `DATA_MODEL_AND_SYNC.md` §2), plus enums in `constants.ts`.
- Cross-field set validation: `completedAt` only allowed when required actuals exist for the exercise type; `rir` required for completed `rir` sets.
- API payload schemas: `PushRequest`, `PushResponse`, `PullResponse`.
- Export TypeScript types inferred from schemas; both apps use these types.

### 2. Dexie database (`apps/web/src/db/`)
- `schema.ts`: Dexie version with the stores from `DATA_MODEL_AND_SYNC.md` §4 (extending Phase 1's `meta`-only version).
- `ids.ts`: `newId()` = UUIDv7.
- **Repositories** `repositories/*.ts`, one per aggregate (exercises, templates, sessions, sets, settings). Every write:
  1. opens one `db.transaction('rw', [table, outbox])`,
  2. sets `updatedAt = now` (and `createdAt` on create; `userId` = current user),
  3. writes the row,
  4. **coalesces** the outbox: delete existing pending entry for `(table, rowId)`, add the new full-row snapshot.
- Deletes are soft (`deletedAt = now`); deleting a parent also soft-deletes its children in the same transaction (session → session_exercises → sets; template → template_exercises → template_sets).
- Read helpers (live queries) filter out `deletedAt`.
- ESLint rule or code review note: components must not import `db` directly, only repositories/hooks.

### 3. Server sync endpoints (`apps/api/src/routes/sync.ts`, logic in `services/sync.ts`)
- `POST /api/sync/push` and `GET /api/sync/pull` exactly per `DATA_MODEL_AND_SYNC.md` §5:
  - one transaction + `pg_advisory_xact_lock(hashtext(userId))`,
  - Zod validation, `userId` forced from session, preset exercises rejected,
  - ownership checks on parent references,
  - LWW upsert (`incoming.updatedAt >= existing.updatedAt`), `updatedAt` clamped to `now + 5 min`,
  - tombstone cascade when a parent is tombstoned,
  - per-mutation result statuses,
  - pull returns own rows + preset exercises with `serverVersion > cursor`, ordered, `limit`, `hasMore`.
- Side-effects hook after commit: create an empty `onSessionsChanged(userId, sessionIds, exerciseIds)` service that later phases fill (PR recompute in Phase 5, feed/notifications in Phases 8–9).

### 4. Client sync engine (`apps/web/src/sync/`)
- `syncNow()`: single-flight; push outbox in batches of ≤ 200 (in `seq` order) → pull loop until `!hasMore` → store cursor + `lastSyncAt` in `meta`.
- Applying pulled rows: LWW, and **skip any row that has a pending outbox entry**.
- Remove outbox entries for `applied` / `ignored_stale`; move `rejected` to a `syncErrors` store (shown in Settings → Sync later).
- Triggers: app start, `online`, `visibilitychange → visible`, debounced 2 s after local writes (via a repository hook/event), every 60 s while visible.
- Exponential backoff on network errors (cap ~60 s).
- `401` → stop, route to `/login`, **keep the outbox**. After re-login as the **same** user, resume. Signing in as a **different** user clears the DB (with warning if outbox non-empty).
- Status store (Zustand or a tiny `useSyncExternalStore` store): `status: 'idle' | 'syncing' | 'offline' | 'error'`, `pendingCount` (live count of outbox), `lastSyncAt`.
- `navigator.storage.persist()` requested after login.
- Multi-tab safety: use a Web Lock (`navigator.locks.request('stryde-sync', …)`) so only one tab syncs at a time.

### 5. UI in this phase
- `SyncIndicator` component in the top bar (states from `UI_DESIGN.md` §3), built with shadcn primitives (`Popover`/`Drawer` for the details sheet).
- Initial-sync screen ("Downloading your data") when cursor is `0` after login.
- Detect >1 active session after a pull → shadcn `Dialog` asking which to keep (finish or discard the other).

## Tests (required)
- API integration (real Postgres): every case in `DATA_MODEL_AND_SYNC.md` §8 that concerns sync (LWW both directions, stale ignored, child-before-parent, idempotent replay, tombstone cascade, clamp, preset rejection, cross-user parent rejected).
- Client: repositories write row + coalesced outbox atomically (`fake-indexeddb`).
- **Two-device convergence test:** two Dexie instances + real API; both edit the same set offline, sync in either order → identical state.

## Acceptance criteria
- [ ] All tests above pass.
- [ ] Manually: create rows offline (via a temporary dev button), go online → they appear on the server; a second browser profile pulls them.
- [ ] Sync indicator shows correct state for synced / syncing / offline with N pending / error.
