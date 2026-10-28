# Progress
## Current phase
Phase 2 — Local DB & Sync (`plan/phase-02-local-db-sync.md`): **done**, all acceptance criteria pass. Next: Phase 3 — Exercises & Templates (`plan/phase-03-exercises-templates.md`), not started.
(Phase 1 still has two owner-verification items, see Open questions.)
## Done
- [x] Phase 0 — Scaffold
  - [x] Bun workspaces (`apps/web`, `apps/api`, `packages/shared`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), Biome, Vitest in every package, root scripts
  - [x] `apps/web`: Vite 8 + React 19, TanStack Router file routes (`__root`, `/`), Tailwind v4, shadcn/ui (radix base) with tokens mapped in `src/styles/globals.css`, dark only; §6.1 components installed; fontsource Inter + Barlow Condensed; lucide-react
  - [x] `apps/api`: Hono on `Bun.serve` (`idleTimeout: 255`), `GET /api/health`, `bun --watch` dev
  - [x] `packages/shared`: `constants.ts`, `units.ts` + table-driven tests
  - [x] `docker/compose.dev.yml` (Postgres 17), Vite `/api` proxy, `bun run dev` runs both, `docker/.env.example`
  - [x] `.gitignore`, `.editorconfig`
  - [x] Acceptance: dark page with Barlow heading + blue shadcn Button (screenshot checked); `/api/health` via proxy; typecheck/lint/test green
- [x] Phase 1 — Database & Auth (implemented)
  - [x] Drizzle schema for all §2 synced + §3 server-only tables (`apps/api/src/db/schema/`), enums from `@stryde/shared` constants
  - [x] Migrations: `0000_init` (generated) + `0001_sync_infra` (hand-written: `sync_version_seq`, `set_server_version()` trigger on all 8 synced tables, 15 `DEFERRABLE INITIALLY DEFERRED` FKs); `(userId, serverVersion)` indexes; partial unique "one active session per user"
  - [x] Migrations + preset seed run on API boot (`src/index.ts`); `db:generate` / `db:migrate` scripts
  - [x] 84 preset exercises with hard-coded UUIDv7s, idempotent upsert that only rewrites changed rows
  - [x] Better Auth: email+password, username plugin (sign in by email or username), Google provider (enabled when env is set), Drizzle adapter, UUID ids, 60-day rolling cookie session, rate limiting, `user_settings` row created on signup
  - [x] `GET /api/me`, `GET /api/users/username-available?u=`
  - [x] Web: Dexie `meta` table, Better Auth client, offline-first root guard, `/login`, `/signup` (live username check), `/onboarding` (username for Google users → units → install placeholder)
  - [x] Tests: migrations/triggers/deferred FKs/one-active-session/seed idempotency; auth (sign up, sign in by email/username, duplicates, invalid usernames, `/api/me` 401, cookie attributes, update-user username); web `meta` user-switch clearing
  - [x] Browser-verified (Playwright, headless): sign up → onboarding → home; sign out; sign in by username and by email; wrong password error; reload with API unreachable opens as the cached user; cookie revoked → revalidate 401 → `/login`; user without username forced through username onboarding; Google authorize redirect uses `${PUBLIC_URL}/api/auth/callback/google`
  - [ ] Owner: real Google sign-in (needs OAuth credentials)
  - [ ] DevTools-offline full reload (needs the Phase 6 service worker)
- [x] Phase 2 — Local DB & Sync
  - [x] Shared Zod row schemas for all 8 synced tables (`packages/shared/src/schemas/rows.ts`) incl. set completion / RIR / rep-range refinements, `setCompletionError(set, exerciseType)`; payloads `PushRequest`/`PushResponse`/`PullResponse`, `SYNC_TABLES` (parents first)
  - [x] Migration `0002`: the one-active-session index is no longer unique (see Decisions)
  - [x] `POST /api/sync/push`, `GET /api/sync/pull` (`routes/sync.ts`, `services/sync.ts`): advisory lock, per-row validation, ownership + in-batch parent resolution, exercise-type set check, LWW with 5-min clamp, tombstone cascade, REPEATABLE READ pull; empty `onSessionsChanged` hook (`services/session-effects.ts`)
  - [x] Dexie v2 (`apps/web/src/db/db.ts`) with all stores + `outbox` + `syncErrors`; `newId()` (UUIDv7); `meta.owner`
  - [x] Repositories (`db/repositories/`): `core.ts` (`mutate`/`Writer`: validate, write row, coalesce outbox, one transaction, `onLocalWrite`), exercises, templates, sessions, sets, settings; cascading soft deletes; one active session; presets read-only
  - [x] Sync engine (`sync/engine.ts`): single-flight, parents-first batches of 200, pull loop, LWW apply, pending-entry rule, `syncErrors`; HTTP transport; controller with all triggers, backoff, Web Lock, `storage.persist()`; status store + live pending count
  - [x] UI: `SyncIndicator` (synced / syncing / offline + N / error + Retry, Drawer details), "Downloading your data" first-sync screen, two-active-sessions dialog, sign-out warning with pending changes, login/signup notice for another owner's unsynced changes, temporary dev panel on Today (dev builds only)
  - [x] Onboarding units step now writes `user_settings` through the settings repository (the `meta['onboarding.unit']` stopgap is gone)
  - [x] Biome `noRestrictedImports`: routes/components can't import `@/db/db`, `dexie`, or the sync engine/transport
  - [x] Tests: shared schemas (table-driven); API integration for every §8 sync case; repositories (atomic row + coalesced outbox, cascades, validation); engine with a scripted transport; **two-device convergence against the real API** (web Vitest global setup starts the API on `<db>_web_test`)
  - [x] Browser-verified (Playwright, headless, two contexts): offline rows → "Offline, 5 changes pending" → online → synced; second profile sees "Downloading your data" and the same rows; 500s → error → Retry → synced; two workouts started offline → dialog → discard → resolved on both; sign-out warning; onboarding unit `lb` reached the server
## Decisions
- 2026-10-24: Bun is the API runtime and the package manager (Bun workspaces, `bun.lock`) instead of Node + pnpm. Hono runs on `Bun.serve`; the API runs from TS source with no build step. Docs updated to match. — owner preference; simpler single runtime.
- 2026-10-24: Tests stay on Vitest (run via `bun run test`), not `bun test`. — Vite/`fake-indexeddb` setup on the web side fits Vitest; one runner for all packages.
- 2026-10-24: Accent color changed from volt green to blue `#4D9FFF`; visual style made more minimal (see `UI_DESIGN.md`). — owner preference.
- 2026-10-24: Biome (2.6) for lint + format instead of ESLint + Prettier. — one fast tool, little config. `components/ui/**` and `routeTree.gen.ts` are excluded (generated code).
- 2026-10-24: Versions pinned at scaffold: Bun 1.3.14 (`packageManager`), TypeScript 7 (native compiler; `baseUrl` is removed, so `paths` are relative to the tsconfig), Vite 8, Vitest 5, Tailwind 4.3, shadcn CLI 4.22 (`radix-nova` style).
- 2026-10-24: `routeTree.gen.ts` is committed (not gitignored) so `typecheck` works on a fresh checkout/CI without running Vite first.
- 2026-10-24: shadcn's `--accent` is mapped to the neutral `--surface-3` (hover/selected surface); the brand blue is `--primary` and the Tailwind color `brand` (`bg-brand`, `bg-brand-dim`). App tokens are exposed as `surface`, `surface-2`, `surface-3`, `faint`, `pr`, `failure`, `warmup`, `success`, `warning`; `font-display` = Barlow Condensed; `tnum` utility for tabular numbers.
- 2026-10-24: shadcn component tweaks: Button sizes raised to ≥48px (default `h-12`, `lg` `h-14`, `icon` `size-12`); Input `h-12` on `surface-2`, 16px text (avoids iOS zoom); Sonner forced to `theme="dark"` and `next-themes` removed. shadcn now uses its own `cn` package (replaces clsx + tailwind-merge).
- 2026-10-24: Display name and avatar use Better Auth's built-in `user.name` / `user.image` columns instead of extra `displayName` / `avatarUrl` columns; `/api/me` exposes them as `displayName` / `avatarUrl`. `DATA_MODEL_AND_SYNC.md` §3 updated. — avoids duplicate columns Better Auth would otherwise keep in sync.
- 2026-10-24: `needsOnboarding` is derived (`username IS NULL`), not stored. — can't drift from the data.
- 2026-10-24: Usernames are lowercased (validated post-normalization against `^[a-z0-9_]{3,20}$`); Better Auth's `displayUsername` is disabled. Email sign-ups must include a username (server hook rejects otherwise).
- 2026-10-24: All Better Auth/server-only table ids are UUIDs (`advanced.database.generateId: 'uuid'`, DB `defaultRandom()`); synced-table ids stay client UUIDv7.
- 2026-10-24: DB columns are camelCase (matching `DATA_MODEL_AND_SYNC.md`'s quoted names), tables snake_case. Timestamps are `timestamptz`; `localDate` is `date` (string mode); kg values `numeric(7,2)` in number mode.
- 2026-10-24: The onboarding units choice is stored in Dexie `meta['onboarding.unit']`, because `user_settings` may only be written through repositories, which arrive in Phase 2. **Phase 2 must apply it** to the user's settings row via the repository and then delete the meta key.
- 2026-10-24: Sign-out is disabled while offline (the server must clear the httpOnly cookie). The "unsynced changes" warning is added once the outbox exists (Phase 2).
- 2026-10-24: Auth rate limiting is on in production only (Better Auth default), forceable in dev with `AUTH_RATE_LIMIT=1`; sign-in 10/min and sign-up 5/min per IP.
- 2026-10-28: The one-active-session partial index is no longer unique (migration `0002`). — With it, the second device's push of its own active session fails, so the conflict can't reach both devices as §8 requires. The repository still refuses to start a second session locally; conflicts are resolved by the dialog. `DATA_MODEL_AND_SYNC.md` §2 updated.
- 2026-10-28: Sync payload table names are the camelCase Dexie store names (`sessionExercises`, not `session_exercises`). Rows on the wire and in Dexie never carry `serverVersion`.
- 2026-10-28: The client pushes parents-first by table, then outbox order (spec said outbox order). — A coalesced parent edit moves to the end of the queue, and with >200 entries a child could otherwise land in an earlier batch than its new parent and be rejected for good. LWW is per row, so order between rows doesn't change results.
- 2026-10-28: Pull applies a row despite a pending outbox entry when the incoming row is strictly newer, and drops the entry. — Otherwise the cursor moves past it, the push is `ignored_stale`, and the device keeps the losing version forever. Documented in §5.
- 2026-10-28: Cascaded tombstones get `updatedAt = GREATEST(child, parent)` so devices holding a newer child accept them. Children arriving later under a tombstoned parent are tombstoned in the same push.
- 2026-10-28: Rejected mutations are moved to `syncErrors` and logged; the indicator's details mention them. A list with actions arrives with Settings → Sync (Phase 3+).
- 2026-10-28: `meta.owner` (id + username) records whose data is local and survives a 401; `setCurrentUser` clears the DB when a different user signs in. — Phase 1 compared against `meta.currentUser`, which a 401 deletes, so another user signing in after a 401 would have inherited the data.
- 2026-10-28: Different-user warning is a notice on /login and /signup ("@x has N unsynced changes … signing in as someone else deletes them"), not a confirm dialog. — Covers email, username and Google sign-in with one mechanism.
- 2026-10-28: Two-active-sessions dialog offers "finish the other(s)" (finishedAt = now) or "discard" (soft delete with children). — Simplest option consistent with §8.
- 2026-10-28: Status `error` covers HTTP errors and malformed responses (retried with backoff); `offline` covers fetch failures and `navigator.onLine === false`.
- 2026-10-28: Added `dexie-react-hooks`, `uuid`, `date-fns` to web; `postgres` as a web dev dependency for the convergence test's DB setup.
- 2026-10-24: API integration tests run against `<db>_test`, recreated by Vitest global setup; skipped without `DATABASE_URL`. Drizzle migrations are excluded from Biome (generated).
## Open questions
- Google OAuth: create a Google Cloud OAuth client (authorized origin `http://localhost:5173` for dev, redirect URI `http://localhost:5173/api/auth/callback/google`), put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the API env, and try "Continue with Google" to tick the last Phase 1 acceptance item.
- "Reload with DevTools offline" can't pass before Phase 6: without a service worker the browser can't load `index.html` offline at all. The guard itself works without the network (verified by blocking `/api/*` and reloading). Proposal: tick this item in Phase 6.
## Notes for the next session
- `apps/api/src/app.ts` is the runtime-agnostic Hono app (tests use `app.request()` under Vitest); `src/index.ts` is the Bun server entry. Keep Bun-only APIs out of `app.ts`.
- Dev DB: `docker compose -f docker/compose.dev.yml up -d` → `postgres://stryde:stryde@localhost:5432/stryde`. Integration tests: `DATABASE_URL=postgres://stryde:stryde@localhost:5432/stryde bun run test`.
- `0001_sync_infra.sql` is hand-written. Never delete the migrations folder to regenerate (that wipes it). New synced tables need their trigger, owner FK and deferred FKs added in a new custom migration (`drizzle-kit generate --custom`).
- Integration tests: `DATABASE_URL=… bun run test` runs API tests on `<db>_test` and the web convergence test against a real API process on `<db>_web_test` (started by `apps/web/src/test/api-server.ts`). Test timestamps must stay within now + 5 min, or the server clamps them.
- Own-data writes: `mutate(tables, (w) => …)` in `db/repositories/core.ts`. Pass every table the callback reads or writes. Reads for UI: repository list/get functions wrapped in `useLiveQuery` inside a hook.
- `requestSync()` (`sync/controller.ts`) syncs immediately: call it after finishing a workout (Phase 4).
- The dev panel (`features/dev/`) is temporary; remove it once Phase 3/4 screens can create data.
- `onSessionsChanged` (`apps/api/src/services/session-effects.ts`) is where Phase 5 PR recompute and Phases 8–9 feed/notifications go.
- fontsource imports pull in every subset (cyrillic, greek, vietnamese…). Consider latin/latin-ext-only imports in Phase 6 to keep the SW precache small.
- Verify `web-push` works under Bun (test planned in Phase 9).
