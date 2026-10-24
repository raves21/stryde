# Progress
## Current phase
Phase 1 — Database & Auth (`plan/phase-01-database-auth.md`): **implemented; two acceptance items need owner verification** (see Open questions). Next: Phase 2 — Local DB & Sync (`plan/phase-02-local-db-sync.md`), not started.
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
- 2026-10-24: API integration tests run against `<db>_test`, recreated by Vitest global setup; skipped without `DATABASE_URL`. Drizzle migrations are excluded from Biome (generated).
## Open questions
- Google OAuth: create a Google Cloud OAuth client (authorized origin `http://localhost:5173` for dev, redirect URI `http://localhost:5173/api/auth/callback/google`), put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the API env, and try "Continue with Google" to tick the last Phase 1 acceptance item.
- "Reload with DevTools offline" can't pass before Phase 6: without a service worker the browser can't load `index.html` offline at all. The guard itself works without the network (verified by blocking `/api/*` and reloading). Proposal: tick this item in Phase 6.
## Notes for the next session
- `apps/api/src/app.ts` is the runtime-agnostic Hono app (tests use `app.request()` under Vitest); `src/index.ts` is the Bun server entry. Keep Bun-only APIs out of `app.ts`.
- Dev DB: `docker compose -f docker/compose.dev.yml up -d` → `postgres://stryde:stryde@localhost:5432/stryde`. Integration tests: `DATABASE_URL=postgres://stryde:stryde@localhost:5432/stryde bun run test`.
- `0001_sync_infra.sql` is hand-written. Never delete the migrations folder to regenerate (that wipes it). New synced tables need their trigger, owner FK and deferred FKs added in a new custom migration (`drizzle-kit generate --custom`).
- Phase 2: apply `meta['onboarding.unit']` (see Decisions); add the outbox-non-empty warning to sign-out; extend Dexie with a new version (keep `meta`).
- fontsource imports pull in every subset (cyrillic, greek, vietnamese…). Consider latin/latin-ext-only imports in Phase 6 to keep the SW precache small.
- Verify `web-push` works under Bun (test planned in Phase 9).
