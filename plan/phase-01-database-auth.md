# Phase 1 — Database & Auth

> Release: **v1** · Depends on: Phase 0 · Next: `phase-02-local-db-sync.md`
> Normative references: `DATA_MODEL_AND_SYNC.md` §2–3, `PRODUCT_SPEC.md` §3.

## Goal
All tables exist in Postgres via migrations that run on boot; users can sign up and sign in with email/username + password or Google; an already-signed-in user can open the app offline.

## Tasks

### 1. Drizzle schema & migrations
- Tables per `DATA_MODEL_AND_SYNC.md` §2 (synced) and §3 (server-only), in `apps/api/src/db/schema/*.ts`.
- Shared column helper for synced tables: `id uuid pk`, `userId`, `createdAt`, `updatedAt`, `deletedAt`, `serverVersion bigint`.
- Raw SQL migration (drizzle custom migration) for:
  - `CREATE SEQUENCE sync_version_seq;`
  - A trigger function `set_server_version()` that sets `NEW."serverVersion" = nextval('sync_version_seq')` on INSERT/UPDATE, attached to every synced table.
  - Foreign keys between synced tables as `DEFERRABLE INITIALLY DEFERRED`.
  - Index `(userId, serverVersion)` on every synced table; `(sessionId)` etc. for lookups.
  - Partial unique index: one active session per user (`WHERE "finishedAt" IS NULL AND "deletedAt" IS NULL`). Keep it as a safety net; conflicts are resolved client-side (see sync edge cases).
- `drizzle.config.ts`, scripts `db:generate`, `db:migrate`.
- **Run migrations on API boot** (drizzle migrator) before the server listens.

### 2. Preset exercise seed
- `apps/api/src/db/seed/exercises.ts`: 60–100 presets (name, type, muscleGroup, equipment, defaultRestSeconds), each with a **hard-coded stable UUID** so seeding is an idempotent upsert.
- Run after migrations on every boot (cheap upsert). `userId = null`, `isPreset = true`.
- Cover all muscle groups and the three types (e.g. Plank, Side Plank, Dead Hang as `timed`; Pull-up, Chin-up, Dip, Push-up as `bodyweight`).

### 3. Better Auth
- Config in `apps/api/src/auth.ts`, mounted at `/api/auth/*`.
- Plugins/features: email + password, **`username` plugin** (sign in with email *or* username), **Google** social provider, Drizzle adapter.
- Extra user fields: `username` (unique, `^[a-z0-9_]{3,20}$`), `displayName`, `avatarUrl`.
- Session: cookie, `httpOnly`, `secure` in production, `sameSite=lax`, 60-day expiry with rolling refresh.
- Rate limiting on auth routes (Better Auth built-in).
- No email verification / password reset (no SMTP in v1; see `PRODUCT_SPEC.md` §3).
- On user creation: insert the `user_settings` row with defaults.
- Google redirect URI: `${PUBLIC_URL}/api/auth/callback/google`. Users created via Google have no username → `needsOnboarding` flag.
- Endpoint `GET /api/me` → current user + settings (used by the client to cache the user).
- Endpoint `GET /api/users/username-available?u=` for the live check on signup/onboarding.

### 4. Web: auth screens (follow `UI_DESIGN.md` §5.1–5.2)
- Routes `/login`, `/signup`, `/onboarding`.
- Better Auth client for sign in / sign up / Google.
- Auth guard in the root route's `beforeLoad`:
  - If a cached user exists in Dexie `meta.currentUser` → allow (works **offline**). Revalidate in the background when online; a `401` clears the session and routes to `/login` (but never clears unsynced data; see Phase 2).
  - If no cached user → `/login`.
  - If `needsOnboarding` → `/onboarding`.
- Onboarding steps for v1: username (Google users only), units (KG default / LB), install guide (can be a placeholder until Phase 6). The notifications step is added in Phase 9.

> Dexie is set up properly in Phase 2. For this phase create the Dexie database with just the `meta` table, and extend it in Phase 2 with a new Dexie version.

### 5. Env vars
Add to `docker/.env.example`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## Tests
- Migrations apply cleanly to an empty DB; seed is idempotent (run twice → same row count).
- Trigger: inserting/updating a synced row increases `serverVersion`.
- Auth integration: sign up, sign in by email, sign in by username, duplicate username rejected, `/api/me` requires a session.

## Acceptance criteria
- [ ] Sign up and sign in with email, with username, and with Google.
- [ ] Google user is forced through username onboarding.
- [ ] After signing in, reload the page with DevTools offline → app opens as the signed-in user.
- [ ] All checks green.
