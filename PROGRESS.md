# Progress
## Current phase
Phase 0 — Scaffold (`plan/phase-00-scaffold.md`), not started
## Done
- [ ] Phase 0 — Scaffold
## Decisions
- 2026-10-24: Bun is the API runtime and the package manager (Bun workspaces, `bun.lock`) instead of Node + pnpm. Hono runs on `Bun.serve`; the API runs from TS source with no build step. Docs updated to match. — owner preference; simpler single runtime.
- 2026-10-24: Tests stay on Vitest (run via `bun run test`), not `bun test`. — Vite/`fake-indexeddb` setup on the web side fits Vitest; one runner for all packages.
- 2026-10-24: Accent color changed from volt green to blue `#4D9FFF`; visual style made more minimal (see `UI_DESIGN.md`). — owner preference.
## Open questions
- Lint/format: Biome or ESLint + Prettier (decide in Phase 0; Biome recommended).
## Notes for the next session
- `Bun.serve` default `idleTimeout` is 10 s; set it higher so SSE (Phase 9) isn't cut off.
- Verify `web-push` works under Bun (test planned in Phase 9).
