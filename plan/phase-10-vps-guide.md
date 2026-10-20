# Phase 10 — VPS Deployment Guide (documentation only)

> Release: after v2 (can be done any time after Phase 7) · Depends on: Phase 7
> Output: **`docs/deploy-vps.md`**. Do not change infra code except where the guide needs a small optional file (e.g. a `docker/compose.caddy.yml` override or `docker/Caddyfile` example).

## Context
The owner currently runs Stryde on a home server (ZeroTier + Cloudflare Tunnel, see `phase-07-docker-cicd.md`) and plans to buy a VPS. The guide must let them move with minimal risk and downtime.

## Required sections in `docs/deploy-vps.md`
1. **Choosing a VPS** — 1–2 vCPU, 2 GB RAM is plenty for ~20 users; Ubuntu LTS; note CPU architecture (match the image `platforms`).
2. **Initial hardening** — non-root sudo user, SSH key auth only, disable root login and password auth, `ufw` (allow 22; plus 80/443 only for Option B), unattended-upgrades, optional fail2ban.
3. **Install Docker Engine + compose plugin** (official apt repo), add the deploy user to the `docker` group, `docker login ghcr.io` with a `read:packages` PAT.
4. **Option A — keep Cloudflare Tunnel (recommended)**: run `cloudflared` on the VPS in Docker on a shared network; same `compose.yml` and `.env` as the home server; point the tunnel's public hostname at the VPS connector. No open inbound ports except SSH.
5. **Option B — direct HTTPS with Caddy**: add a `caddy` service publishing 80/443 with a `Caddyfile` reverse-proxying to the app (`reverse_proxy app:3000` with `flush_interval -1` so SSE streams aren't buffered); DNS A/AAAA record to the VPS IP (Cloudflare proxy optional; if proxied, keep the cache rules from Phase 7).
6. **CI/CD changes** — the deploy job SSHes directly to the VPS public IP: remove the ZeroTier step, update secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`). Show the exact diff to `deploy.yml`.
7. **Data migration from the home server**
   - Put the app in a brief maintenance window: `docker compose stop app` on the home server.
   - `docker compose exec db pg_dump -U stryde -Fc stryde > stryde.dump`, copy with `scp`, restore on the VPS with `pg_restore --clean --if-exists` into a fresh `db` container.
   - Copy the `uploads` volume (tar via a throwaway container).
   - **Reuse the same `.env` secrets**: same `BETTER_AUTH_SECRET` (otherwise everyone is logged out) and **same VAPID keys** (otherwise every push subscription breaks). Same `PUBLIC_URL` / domain so the PWA origin, cookies, and installed apps keep working.
   - Note: clients keep unsynced changes in their outbox during the window and sync afterwards, so no workout data is lost.
8. **Cutover & verification checklist** — switch tunnel/DNS, check `/api/health` version, sign in, log a test set, check sync on two devices, test a push notification, check Google OAuth (origin/redirect unchanged if the domain is the same).
9. **Rollback** — point the tunnel/DNS back to the home server (keep it untouched until verified; any data written on the VPS meanwhile would need a reverse dump).
10. **Future: backups** — recommend a nightly `pg_dump` cron to another disk/host with retention; out of scope for now.

## Acceptance criteria
- [ ] `docs/deploy-vps.md` covers every section above with copy-pasteable commands.
- [ ] Any example config files referenced by the guide exist in `docker/` and are clearly marked optional.
