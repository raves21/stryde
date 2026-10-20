# Phase 0 — Scaffold

> Release: **v1** · Depends on: nothing · Next: `phase-01-database-auth.md`
> Read `AGENTS.md` and `IMPLEMENTATION_PLAN.md` (stack, layout) before starting.

## Goal
An empty but correctly wired monorepo: the web app shell renders with the Stryde design tokens and shadcn/ui, the API answers a health check, and all checks run.

## Tasks
1. **Workspace**
   - pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`.
   - Root `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), per-package `tsconfig.json`.
   - ESLint + Prettier (or Biome; pick one and note it in `PROGRESS.md`).
   - Vitest configured in every package; root scripts: `dev`, `build`, `typecheck`, `lint`, `test`.
2. **`apps/web`**
   - Vite + React + TypeScript.
   - TanStack Router with **file-based routes** (Vite plugin / codegen). Create a root route with an empty layout and a placeholder `/` route.
   - Tailwind CSS v4.
   - **shadcn/ui**: run `shadcn init` (Vite flow), components into `src/components/ui/`, `cn()` helper in `src/lib/utils.ts`. Map the color tokens from `UI_DESIGN.md` §2 onto shadcn's CSS variables (`--background`, `--card`, `--primary`, `--muted`, `--border`, `--destructive`, …) in the global CSS and set the app permanently dark (no light theme block, no theme toggle).
   - Install the initial shadcn components listed in `UI_DESIGN.md` §6.1 (button, input, drawer, dialog, sheet, tabs, switch, toggle-group, badge, skeleton, sonner, dropdown-menu, popover, chart, …).
   - Fonts: `@fontsource/barlow-condensed` (600, 700) and `@fontsource/inter` (400, 500, 600), imported in `main.tsx`. No Google Fonts CDN.
   - `lucide-react` installed.
3. **`apps/api`**
   - Hono on Node (`@hono/node-server`), entry `src/index.ts`.
   - `GET /api/health` → `{ ok: true, version: process.env.GIT_SHA ?? "dev" }`.
   - `tsx watch` for dev; `tsc` (or tsup) build to `dist/`.
4. **`packages/shared`**
   - Exports `constants.ts` (empty enums placeholder), `units.ts` (kg↔lb with rounding helpers + tests).
   - Consumed by both apps via `workspace:*`.
5. **Dev environment**
   - `docker/compose.dev.yml`: Postgres 17 only, port 5432, named volume.
   - Vite dev server proxies `/api` → `http://localhost:3000`.
   - `pnpm dev` runs api + web concurrently.
   - `docker/.env.example` started (fill in as variables are added).
6. **Repo hygiene**: `.gitignore`, `.editorconfig`, `PROGRESS.md` created from the template in `AGENTS.md`.

## Files created (main ones)
```
package.json  pnpm-workspace.yaml  tsconfig.base.json  PROGRESS.md
apps/web/{vite.config.ts, components.json, src/main.tsx, src/styles/globals.css, src/routes/__root.tsx, src/routes/index.tsx, src/lib/utils.ts}
apps/api/src/index.ts
packages/shared/src/{index.ts, constants.ts, units.ts, units.test.ts}
docker/compose.dev.yml  docker/.env.example
```

## Acceptance criteria
- [ ] `pnpm dev` shows a dark page using `--bg`, Barlow Condensed heading, and a shadcn `Button` styled with the volt accent.
- [ ] `/api/health` reachable through the Vite proxy.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.
