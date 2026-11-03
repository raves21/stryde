# Handover

Context for the next session working on Stryde. Read this first, then `PROGRESS.md` (the source of truth for status and decisions); the reading order in `AGENTS.md` / `CLAUDE.md` still applies.

## Where things stand (2026-11-03)

- **Phases 0–7 are implemented** (v1 feature-complete): auth, local-first sync, exercises/templates, active workout, history/calendar/charts/PRs, PWA (offline cold start, install, safe updates), Docker + CI/CD + deploy guide.
- **Phase 7 acceptance is blocked on the owner**, not on code. `main` was pushed; **CI #1 passed** on GitHub; **Deploy #1 failed** in the `deploy` job after ~20 s (the `build` job ran ~2 min, so the image is most likely in GHCR). Most likely cause: no secrets set yet. Logs need a signed-in look: https://github.com/raves21/stryde/actions/runs/40649038374
- The owner's remaining steps are in **`docs/owner-checklist.md`** (server, deploy key, GitHub secrets, Cloudflare, first deploy, rollback test, phone installs, Google OAuth). Full instructions: `docs/deploy-home-server.md`.
- Local `main` is **1 commit ahead** of `origin/main` (`3fb7cca`, a `PROGRESS.md` update), plus this file. Push only when the owner asks.
- **Next:** help the owner get the first deploy green (fix the workflow if their logs show a real bug), then Phase 8 (social, v2) once they say go. Don't start v2 early (`CLAUDE.md`).

## Open decisions (ask the owner)

1. **Inline PR hint during a workout** (`UI_DESIGN.md` §5.4: gold 🏆 "e1RM PR" chip on a just-completed set): build it or drop it? Not built yet; PRs show on the finish sheet, session detail, records and charts. If built: `detectPRs` against `getExerciseHistory` (both exist).
2. **When to start Phase 8.**
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
- Last full run: 283 unit/integration tests + 2 e2e green, lint and typecheck clean.

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
- **gh CLI is not installed**; read GitHub Actions status with WebFetch on the public Actions pages (step logs need sign-in, so ask the owner to paste them).

## Code map (what to reuse)

- `packages/shared/src/` — `schemas/` (row + sync payload Zod), `calc/` (e1RM, volume, best set, `detectPRs`, `prTimeline`, `computeAllPRs`, `seriesForChart`), `units.ts`, `constants.ts`.
- `apps/api/src/` — `app.ts` (`createApp(staticDir)`: API + SPA static serving), `services/sync.ts` (push/pull), `services/session-effects.ts` (`onSessionsChanged` → PR recompute; Phase 8–9 feed/notifications go here), `static.ts`, `db/migrations/0001_sync_infra.sql` (hand-written, never regenerate).
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
