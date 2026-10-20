# AGENTS.md — Rules for AI coding agents

> Place at the repo root. (Copy or symlink to `CLAUDE.md` / `.cursorrules` / etc. depending on the agent tool.)

## Read first, in order
1. `PRODUCT_SPEC.md`: what the app does (source of truth for behavior)
2. `DATA_MODEL_AND_SYNC.md`: schema and sync protocol (normative)
3. `IMPLEMENTATION_PLAN.md`: stack, layout, phases, acceptance criteria
4. `UI_DESIGN.md`: look & feel, screens, components
5. The current phase file in `plan/` (e.g. `plan/phase-02-local-db-sync.md`). Only load the phase you're working on.

If docs conflict: `DATA_MODEL_AND_SYNC.md` wins for data/sync, `PRODUCT_SPEC.md` wins for behavior, `UI_DESIGN.md` wins for visuals. Flag the conflict in your summary.

## How to work
- Work **one phase at a time** using the phase files in `plan/` (index in `IMPLEMENTATION_PLAN.md` §5). Don't start phase N+1 until phase N's acceptance criteria pass.
- Keep a `PROGRESS.md` at the repo root: current phase, checklist of tasks done, open questions, decisions made. Update it at the end of every session so the next agent can resume.
- Small commits with conventional messages (`feat(sync): ...`, `fix(web): ...`).
- Before saying something is done: `pnpm typecheck && pnpm lint && pnpm test` must pass. Don't claim tests pass without running them.
- When unsure about a product decision, **don't invent features**: pick the simplest option consistent with the spec, record it under "Decisions" in `PROGRESS.md`.
- Use latest stable library versions and check their current docs; don't rely on remembered APIs for Better Auth, TanStack Router, vite-plugin-pwa, Tailwind v4, Drizzle.

## Hard rules (do not break)
1. **All own-data writes on the client go through `apps/web/src/db/repositories/*`**, which write the row **and** the outbox entry in one Dexie transaction. Never write Dexie tables or call sync endpoints from components.
2. **UI reads own data from Dexie**, not from the network. No spinners waiting on the API for your own workouts.
   - Social data (feed, friends, reactions, notifications) is the opposite: **online-only**, never stored in Dexie, never persisted, never queued in the outbox.
3. **IDs are UUIDv7 generated on the client.** Never rely on server-generated IDs for synced tables.
4. **No hard deletes** in synced tables. Use `deletedAt`. Every query filters `deletedAt IS NULL` / `!row.deletedAt`.
5. **Weights are stored in kg.** Convert only at the display/input boundary (`packages/shared/units.ts`).
6. **Calculations (e1RM, volume, PRs) live only in `packages/shared/calc`** and are used by both web and api. No duplicate math elsewhere.
7. **Timers are computed from timestamps** (`startedAt`, `endsAt`), never from incrementing counters.
8. **Validate every API input with the shared Zod schemas.** The server overrides `userId` from the session; never trust the client's.
9. **Authorize every read of another user's data** (friendship accepted + session shared). Return 404, not 403, for unauthorized.
10. **No third-party runtime services** besides Google OAuth and Web Push. No analytics, no CDNs (fonts are self-hosted via fontsource), no external error trackers.
11. **Never auto-reload the app (SW update) while a workout is active.**
12. Secrets only via env vars; never commit `.env`. Keep `docker/.env.example` up to date when adding variables.
13. Dark mode only. Use design tokens, not hard-coded hex values in components.
14. **Use shadcn/ui for all UI primitives** (add components with the shadcn CLI into `apps/web/src/components/ui/`). Don't hand-roll buttons, inputs, dialogs, drawers, tabs, switches, menus, or toasts, and don't add another component library (MUI, Chakra, Mantine, etc.). Restyle via the shadcn CSS variables mapped to the tokens in `UI_DESIGN.md`.

## Conventions
- TypeScript strict; no `any` (use `unknown` + Zod).
- Files: kebab-case. React components: PascalCase exports. One component per file for anything reused.
- Feature folders in `apps/web/src/features/<feature>/` (components, hooks, local utils).
- API routes thin; logic in `services/`.
- Dates: store UTC ISO; format with `date-fns`; calendar uses `localDate`.
- Errors: API returns `{ error: { code, message } }` with proper status codes.
- Tests next to code (`*.test.ts`). Table-driven tests for calc and sync logic.

## `PROGRESS.md` template
```md
# Progress
## Current phase
Phase N — <name> (`plan/phase-NN-*.md`)
## Done
- [x] Phase 0 — Scaffold
- [ ] Phase N tasks: ...
## Decisions
- YYYY-MM-DD: <decision> — <why>
## Open questions
- ...
## Notes for the next session
- ...
```

## Commands (keep these working)
```
pnpm dev            # api + web with Vite proxy, needs docker compose.dev Postgres
pnpm build          # all packages
pnpm typecheck
pnpm lint
pnpm test           # unit + integration (needs DATABASE_URL for api integration)
pnpm db:generate    # drizzle-kit generate migration
pnpm db:migrate     # apply migrations locally
pnpm gen:vapid      # print VAPID keypair
pnpm e2e            # playwright
```

## Definition of done (per task)
- Matches spec and design docs.
- Works offline where the spec says it should (test in DevTools offline mode).
- Tests added/updated; all checks green.
- `PROGRESS.md` updated.
