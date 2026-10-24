# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The rules, reading order, hard rules, conventions and commands in `AGENTS.md` (imported above) apply in full. This file adds orientation only.

## Current state

The repo is currently **specs only**: no code or `package.json` yet. The first piece of work is Phase 0 (`plan/phase-00-scaffold.md`), which creates the Bun workspace monorepo. Read `PROGRESS.md` first to learn which phase is in progress and which decisions are already made, and update it at the end of every session.

Phases run in order (index in `IMPLEMENTATION_PLAN.md` §5). v1 is complete after Phase 7; Phases 8–9 (social, notifications) are v2. Don't build v2 features early, for example no social tables or endpoints during v1 phases.

## Commands

The canonical command list is in `AGENTS.md`. They exist only once Phase 0 is done. Running a single test (Vitest):
```
cd apps/<web|api> && bunx vitest run path/to/file.test.ts   # or packages/shared
bunx vitest run -t "test name"
```
Use `bun run test` (Vitest), not `bun test` (Bun's built-in runner, which isn't used here).
API integration tests need a real Postgres (`docker compose -f docker/compose.dev.yml up -d`) and `DATABASE_URL`.

## Big-picture architecture

- **One deployable**: a Hono-on-Bun container serves `/api/*`, Better Auth at `/api/auth/*`, and the built SPA from the same origin (cookie sessions, no CORS), plus a Postgres 17 container. Cloudflare Tunnel terminates HTTPS. Background jobs (push sending, rest-timer pushes) and SSE pub/sub run **in-process**, so the design assumes a single instance. `Bun.serve` closes idle connections after 10 s by default, so the server sets `idleTimeout` high enough for SSE heartbeats.
- **Two data planes on the client. Keep them separate:**
  - *Own data* (exercises, templates, sessions, sets, settings) is local-first: Dexie is the source of truth for the UI (`useLiveQuery`). Writes go through `apps/web/src/db/repositories/*`, which write the row and a coalesced outbox entry in one transaction. `apps/web/src/sync/` pushes the outbox and pulls by `serverVersion` cursor.
  - *Social data* (feed, friends, reactions, notifications) is online-only via TanStack Query with an in-memory cache only: no Dexie, no persister, no outbox.
- **Sync protocol** (normative, `DATA_MODEL_AND_SYNC.md` §5): row-level LWW on client `updatedAt` (server clamps it to at most now + 5 min); server takes a per-user advisory lock per push; FKs are `DEFERRABLE INITIALLY DEFERRED` so a batch can arrive in any order; a global `sync_version_seq` trigger sets `serverVersion`; pull skips rows that still have a pending outbox entry. Preset exercises (`userId = null`) arrive by pull and are never pushed.
- **Server side effects after push** (`DATA_MODEL_AND_SYNC.md` §6): create or hide feed events, notify friends only if the workout finished ≤ 60 min ago, recompute `personal_records` per touched exercise, and send SSE hints. These live in `apps/api/src/services/`. Routes stay thin.
- **`packages/shared`** is the contract between web and api: Zod schemas for every synced table and API payload, `calc/` (e1RM, best set, volume, PR detection per `PRODUCT_SPEC.md` §6), `units.ts`, and `constants.ts`. When you change a synced table, update the Drizzle schema, Dexie schema, Zod schema and `DATA_MODEL_AND_SYNC.md` together.
- **PWA**: vite-plugin-pwa with `injectManifest` and a custom `apps/web/src/sw.ts` (precache, push, notificationclick). Safari has no Background Sync, so sync triggers are app start, `online`, `visibilitychange`, a debounced 2 s after writes, and 60 s polling while visible.
