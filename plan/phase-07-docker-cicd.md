# Phase 7 — Docker, CI/CD & Home Server Deploy

> Release: **v1 (final v1 phase)** · Depends on: Phase 6 · Next: `phase-08-social.md`
> Reference: `IMPLEMENTATION_PLAN.md` §1 (architecture), §4 (env vars).

## Context (owner's setup)
- Home server reachable remotely over **ZeroTier**; apps are exposed through an existing **Cloudflare Tunnel** (`cloudflared` running as a Docker container).
- Other apps already run on the server, all Dockerized.
- GitHub + GitHub Actions + GHCR are acceptable.
- Owner will move to a VPS later (guide in Phase 10).

**Info the owner must provide (ask, or leave as clearly marked placeholders):** server CPU architecture (amd64 or arm64), the domain/hostname, the name of the Docker network the `cloudflared` container is on.

## Tasks

### 1. Dockerfile (`docker/Dockerfile`, multi-stage)
- Base: `oven/bun` (pinned to the same Bun version as `packageManager`; `-alpine` or `-slim` variant).
- `deps` stage: `bun install --frozen-lockfile`.
- `build` stage: build `apps/web` (Vite). The API and `packages/shared` run from TS source under Bun (no compile step).
- `runtime` stage: API + shared source, production deps (`bun install --production --frozen-lockfile`), migrations folder, web build copied to `/app/public`. `CMD ["bun", "apps/api/src/index.ts"]`. Non-root user (`bun` user in the image). `ENV NODE_ENV=production`. `ARG GIT_SHA` → `ENV GIT_SHA`. `HEALTHCHECK` hitting `/api/health`. `EXPOSE 3000`.
- `.dockerignore` (node_modules, dist, .git, .env, tests output).

### 2. Static serving in the API
- Serve `/app/public` with SPA fallback: any GET that isn't `/api/*` and isn't a file → `index.html`.
- Cache headers: hashed assets → `public, max-age=31536000, immutable`; `index.html`, `sw.js`, `manifest.webmanifest`, `registerSW.js` → `no-cache`.

### 3. Compose (`docker/compose.yml`)
```yaml
services:
  app:
    image: ghcr.io/<owner>/<repo>:${IMAGE_TAG:-latest}
    env_file: .env
    volumes: [uploads:/data/uploads]
    depends_on: { db: { condition: service_healthy } }
    restart: unless-stopped
    networks: [internal, tunnel]
  db:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: stryde, POSTGRES_DB: stryde, POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U stryde"], interval: 5s, retries: 10 }
    restart: unless-stopped
    networks: [internal]
networks:
  internal: {}
  tunnel: { external: true, name: ${TUNNEL_NETWORK:-cf_tunnel} }
volumes: { pgdata: {}, uploads: {} }
```
- No published ports. Cloudflare Tunnel public hostname → `http://app:3000` (service name reachable on the shared network; use a unique container/alias name like `stryde-app` if `app` clashes with other projects).

### 4. CI (`.github/workflows/ci.yml`, on PR + push)
- `oven-sh/setup-bun` (pinned version) → `bun install --frozen-lockfile` with cache → typecheck → lint → unit tests → API integration tests with a `postgres:17` service container (`DATABASE_URL` env) → build.

### 5. Deploy (`.github/workflows/deploy.yml`)
- Trigger: push to `main` (after CI succeeds, e.g. `workflow_run` or same workflow with `needs`), plus `workflow_dispatch` with optional input `tag` for rollbacks.
- **Job `build`**: `permissions: { contents: read, packages: write }`; `docker/setup-buildx-action`, `docker/login-action` (GHCR, `GITHUB_TOKEN`), `docker/build-push-action` with tags `latest` and `${{ github.sha }}`, `build-args: GIT_SHA=${{ github.sha }}`, GHA cache, `platforms` from a repo variable (default `linux/amd64`).
- **Job `deploy`** (needs build):
  1. Join ZeroTier with the official ZeroTier GitHub Action (verify current name/inputs in its docs). Secrets: `ZEROTIER_NETWORK_ID`, `ZEROTIER_CENTRAL_TOKEN` (the action authorizes the runner as a member).
  2. SSH with secrets `DEPLOY_HOST` (ZeroTier IP), `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (e.g. `~/apps/stryde`):
     ```sh
     cd $DEPLOY_PATH
     sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" .env
     docker compose pull app && docker compose up -d app
     docker image prune -f
     ```
  3. Verify: poll `https://<domain>/api/health` until `version == $TAG` (timeout ~2 min) else fail.
- **Fallback documented:** a self-hosted GitHub Actions runner on the home server for the deploy job (only for a private repo).

### 6. One-time server setup (document it)
- `docker login ghcr.io` with a PAT that has `read:packages` (or make the package public).
- Create `DEPLOY_PATH`, copy `compose.yml` and a filled `.env`.
- Add the Cloudflare Tunnel public hostname.

### 7. Cloudflare settings (document and verify)
- Cache Rule: bypass cache for `/api/*`; don't edge-cache `sw.js`, `index.html`, `manifest.webmanifest`.
- Disable Rocket Loader / HTML/JS rewriting for the hostname.
- (SSE comes in Phase 9: needs `text/event-stream`, `no-cache`, heartbeat every 25 s because Cloudflare drops idle connections at ~100 s.)

### 8. Docs: `docs/deploy-home-server.md`
- Prereqs, server setup steps, `.env` reference (link to `.env.example`), Google OAuth console setup (authorized origin + redirect URI), VAPID key generation (`bun run gen:vapid`, for v2), GitHub secrets/variables list, Cloudflare settings, how to deploy, view logs (`docker compose logs -f app`), roll back (run deploy workflow with an older SHA), and DB shell access.

## Acceptance criteria
- [ ] Merge to `main` → image in GHCR → server updated automatically → health check returns the new SHA.
- [ ] App reachable on the tunnel hostname over HTTPS and installable from it.
- [ ] Rollback via `workflow_dispatch` works.
- [ ] `docs/deploy-home-server.md` complete.

> ✅ **v1 complete after this phase.**
