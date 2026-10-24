# Progress
## Current phase
Phase 0 — Scaffold (`plan/phase-00-scaffold.md`): **complete**. Next: Phase 1 — Database & Auth (`plan/phase-01-database-auth.md`), not started.
## Done
- [x] Phase 0 — Scaffold
  - [x] Bun workspaces (`apps/web`, `apps/api`, `packages/shared`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), Biome, Vitest in every package, root scripts
  - [x] `apps/web`: Vite 8 + React 19, TanStack Router file routes (`__root`, `/`), Tailwind v4, shadcn/ui (radix base) with tokens mapped in `src/styles/globals.css`, dark only; §6.1 components installed; fontsource Inter + Barlow Condensed; lucide-react
  - [x] `apps/api`: Hono on `Bun.serve` (`idleTimeout: 255`), `GET /api/health`, `bun --watch` dev
  - [x] `packages/shared`: `constants.ts`, `units.ts` + table-driven tests
  - [x] `docker/compose.dev.yml` (Postgres 17), Vite `/api` proxy, `bun run dev` runs both, `docker/.env.example`
  - [x] `.gitignore`, `.editorconfig`
  - [x] Acceptance: dark page with Barlow heading + blue shadcn Button (screenshot checked); `/api/health` via proxy; typecheck/lint/test green
## Decisions
- 2026-10-24: Bun is the API runtime and the package manager (Bun workspaces, `bun.lock`) instead of Node + pnpm. Hono runs on `Bun.serve`; the API runs from TS source with no build step. Docs updated to match. — owner preference; simpler single runtime.
- 2026-10-24: Tests stay on Vitest (run via `bun run test`), not `bun test`. — Vite/`fake-indexeddb` setup on the web side fits Vitest; one runner for all packages.
- 2026-10-24: Accent color changed from volt green to blue `#4D9FFF`; visual style made more minimal (see `UI_DESIGN.md`). — owner preference.
- 2026-10-24: Biome (2.6) for lint + format instead of ESLint + Prettier. — one fast tool, little config. `components/ui/**` and `routeTree.gen.ts` are excluded (generated code).
- 2026-10-24: Versions pinned at scaffold: Bun 1.3.14 (`packageManager`), TypeScript 7 (native compiler; `baseUrl` is removed, so `paths` are relative to the tsconfig), Vite 8, Vitest 5, Tailwind 4.3, shadcn CLI 4.22 (`radix-nova` style).
- 2026-10-24: `routeTree.gen.ts` is committed (not gitignored) so `typecheck` works on a fresh checkout/CI without running Vite first.
- 2026-10-24: shadcn's `--accent` is mapped to the neutral `--surface-3` (hover/selected surface); the brand blue is `--primary` and the Tailwind color `brand` (`bg-brand`, `bg-brand-dim`). App tokens are exposed as `surface`, `surface-2`, `surface-3`, `faint`, `pr`, `failure`, `warmup`, `success`, `warning`; `font-display` = Barlow Condensed; `tnum` utility for tabular numbers.
- 2026-10-24: shadcn component tweaks: Button sizes raised to ≥48px (default `h-12`, `lg` `h-14`, `icon` `size-12`); Input `h-12` on `surface-2`, 16px text (avoids iOS zoom); Sonner forced to `theme="dark"` and `next-themes` removed. shadcn now uses its own `cn` package (replaces clsx + tailwind-merge).
## Open questions
- None.
## Notes for the next session
- `apps/api/src/app.ts` is the runtime-agnostic Hono app (tests use `app.request()` under Vitest); `src/index.ts` is the Bun server entry. Keep Bun-only APIs out of `app.ts`.
- Dev DB: `docker compose -f docker/compose.dev.yml up -d` → `postgres://stryde:stryde@localhost:5432/stryde`.
- fontsource imports pull in every subset (cyrillic, greek, vietnamese…). Consider latin/latin-ext-only imports in Phase 6 to keep the SW precache small.
- Verify `web-push` works under Bun (test planned in Phase 9).
