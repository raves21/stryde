# Handover

Context for the next session working on Stryde. Read this first, then `PROGRESS.md` (the source of truth for status and decisions); the reading order in `AGENTS.md` / `CLAUDE.md` still applies.

## Where things stand (2026-11-09)

- **Phases 0–9 are implemented and live** at https://stryde.obnsolutions.org on the owner's home server (cloudflared host service `cloudflared-obn` → `127.0.0.1:8173`). Every push to `main` runs CI, then Deploy (build → GHCR → ZeroTier + SSH → compose up → health check on the server). Updates reach phones by themselves (`AutoUpdate`, applied shortly after leaving the app when nothing is in progress).
- **Sports are built and tested locally, not pushed or deployed** (new exercise type `sport`, migration `0003`): live timer, finish sheet, Active minutes on Progress, feed cards, six presets. See `PROGRESS.md` (2026-11-09 decision) and `PRODUCT_SPEC.md` §4.1b.
- Push notifications need the owner's VAPID keys on the server and a real phone to verify (`docs/deploy-home-server.md` §9). Still open for the owner: Cloudflare cache rules for `stryde.obnsolutions.org`, real Google sign-in, the database backup cron (`docker/backup.sh`), the rollback test, phone installs. See `BLOCKERS.md`.
- **Next:** push the sports work when the owner says so; Phase 10 (VPS guide, docs only) if wanted.

## Open decisions (ask the owner)

1. **Push the sports work** (it ships a database migration, applied when the app starts).
2. **Phase 10** (VPS deployment guide): wanted?
3. Real Google sign-in is the last Phase 1 item; needs the owner's OAuth credentials.

## Running it

```sh
docker compose -f docker/compose.dev.yml up -d                       # dev Postgres (stryde-dev-db-1)
PORT=3001 STRYDE_API_PORT=3001 bun run dev                            # app at http://localhost:5173
DATABASE_URL=postgres://stryde:stryde@localhost:5432/stryde bun run test   # all tests incl. integration
bun run typecheck && bun run lint                                     # must pass before claiming done
bun run e2e                                                           # Playwright on the production build (ports 3100/5180, <db>_e2e)
```

- **Port 3000 is taken** on this machine by the owner's ticketing Nuxt dev server (`~/code_projects/frontend/vue/ticketing-client`). Don't stop it; run the Stryde API on 3001 as above. The ticketing project's Postgres has also held port 5432 before; if the Stryde DB container isn't running, ask before touching the other project.
- Local dev accounts from browser checks all use the password `correct-horse-battery`: `p5_mvrnykhd` (6 workouts over 10 weeks, good for charts), `p4_mvrk2ixr` (template + 2 workouts), `p3_mvrj78az` (template with a superset).
- If port 5432 is held by another project's Postgres (it was: `laradock-postgres-1`), don't stop it: run a throwaway one on 5433 (`docker run -d --name stryde-dev-db-alt -p 5433:5432 -e POSTGRES_USER=stryde -e POSTGRES_PASSWORD=stryde -e POSTGRES_DB=stryde postgres:17-alpine`) and use `DATABASE_URL=postgres://stryde:stryde@localhost:5433/stryde` for tests and e2e.
- Last full run: 438 unit/integration tests + 10 e2e green, lint and typecheck clean.

## Gotchas learned the hard way

- **Killing dev servers:** `pkill -f "concurrently -n api,web"` also matches the shell running it and kills your command. Use bracketed patterns: `pkill -f "[c]oncurrently -n api,web"; pkill -f "[s]tryde/apps/web/node_modules/.bin/vite"; pkill -f "[b]un --watch src/index.ts"`.
- **Local `docker build` stalls** downloading packages (BuildKit network, likely ZeroTier MTU). Use `docker build --network host -f docker/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) .`. GitHub runners aren't affected.
- **Biome reformats after edits**, so string-replace scripts (`python3 … replace`) silently miss reformatted text. Assert the old text exists, or use the Edit tool after reading the current file.
- **`bun add` from the wrong directory** adds to the root `package.json` and reorders it. Run it inside the right workspace (`apps/web`, `apps/api`, `packages/shared`).
- **Route tree:** new route files need `src/routeTree.gen.ts` regenerated (`cd apps/web && bunx vite build`, or running Vitest/dev) before `typecheck` passes. The generated file is committed.
- **Vite dev may full-reload once** the first time a newly used dependency is imported (it happened with recharts); browser scripts should tolerate it.
- **Offline in dev** has no service worker: code-split routes only load offline if already loaded. Test real offline behaviour on the production build (`bun run e2e`, or `vite build && vite preview` with `STRYDE_API_PORT` set).
- **Test timestamps** pushed to the server must be within now + 5 min or the server clamps them (LWW clock-skew rule).
- **Playwright:** `getByRole('button', { name: 'Continue' })` also matches "Continue with Google"; use `exact: true`. Single-select `ToggleGroup` items have role `radio`. Preset names: "Dip" (not "Dips"), "Bench Press", "Pull-up", "Plank".
- **Stitch MCP** (owner's design mockups, project `11389384382127711649`) returns metadata only; screenshots/HTML need auth the shell doesn't have. The mockups use the volt accent like the code; `UI_DESIGN.md` wins for visuals.
- **gh CLI** is installed and logged in; use `gh run view <id> --log-failed` for Actions logs (very old job logs may come back empty; the step list still shows which step failed).

## Code map (what to reuse)

- `packages/shared/src/` — `schemas/` (row + sync payload Zod), `calc/` (e1RM, volume, best set, `detectPRs`, `prTimeline`, `computeAllPRs`, `seriesForChart`), `units.ts`, `constants.ts`.
- `apps/api/src/` — `app.ts` (`createApp(staticDir)`: API + SPA static serving), `services/sync.ts` (push/pull), `services/session-effects.ts` (`onSessionsChanged` → PR recompute + feed events; Phase 9 notifications go through `services/notify.ts`), `services/friends.ts` / `access.ts` / `feed.ts` / `reactions.ts` / `session-detail.ts` (Phase 8), `static.ts`, `db/migrations/0001_sync_infra.sql` (hand-written, never regenerate).
- `apps/web/src/features/notifications/` — Phase 9 UI: `push.ts` (support/iOS detection, subscribe/unsubscribe, `keyToBytes`), `components/enable-push.tsx`, `notification-bell.tsx`, `events-runtime.tsx` (SSE), `push-runtime.tsx` (resubscribe, NAVIGATE messages), `rest-push.ts`; route `/notifications` and `/settings/notifications`. `sw.ts` handles `push`, `notificationclick`, `pushsubscriptionchange`.
- `apps/api/src/services/` Phase 9: `notify.ts` (settings gates, triggers, background delivery; tests await `settlePushes`), `push.ts` (web-push, swappable sender for tests), `events.ts` (SSE hub), `rest-timer.ts` (+ loop started in `index.ts`), `notifications.ts` (list), `friend-graph.ts` (friend ids, split out to avoid an import cycle).
- `apps/web/src/features/social/` — Phase 8 UI: `api.ts` (fetch + `ApiError`), `use-social.ts` (TanStack Query hooks, optimistic `useReact`), `reactions.ts` (`toggleReaction`), components (feed card, reaction bar/picker, friend rows, friend session detail). The query client (`lib/query-client.ts`) is in-memory only.
- `apps/web/src/` —
  - `db/repositories/` the only write path for own data (`core.ts`: `mutate`/`Writer`; `supersets.ts`; sessions/templates/exercises/sets/settings). Build new rows from the DB inside the transaction, never from screen state.
  - `sync/` engine (pure), controller (triggers, backoff, Web Lock), status store, hooks.
  - `lib/` pure rules: `workout.ts` (pre-fill, previous matching, rest, formatting), `template-to-session.ts`, `training.ts` (history/stats/PR index), `dates.ts`, `use-now.ts`, `use-wake-lock.ts`.
  - `features/*` UI by feature; `components/app/*` shared building blocks; `components/sets/*` set UI shared by templates and workouts; `components/ui/*` shadcn (generated).
  - `sw.ts` service worker (precache; Phase 9 adds push handlers), `features/pwa/` (update prompt, install).
- Lint rule: routes/components can't import `@/db/db`, `dexie` or the sync engine; go through repositories/hooks.

## Working style the owner has accepted

- Small conventional commits per phase on `main`, ending with the `Co-Authored-By` line from the session's attribution reminder; don't push unless asked.
- Before saying done: typecheck, lint, tests (with `DATABASE_URL`), and a browser check with Playwright screenshots for UI work.
- Record decisions in `PROGRESS.md` → Decisions; keep `docs/owner-checklist.md` in sync with what the owner still has to do.
