# Blockers

What stops Stryde from going live, as of 2026-11-03. None of these are code bugs: v1 (Phases 0–7) is built and tested locally. Step-by-step instructions are in [`docs/owner-checklist.md`](docs/owner-checklist.md) and [`docs/deploy-home-server.md`](docs/deploy-home-server.md).

## 1. ~~First deploy fails: no GitHub secrets~~ (done 2026-11-04)

Deploy run [#40649038374](https://github.com/raves21/stryde/actions/runs/40649038374) failed at **Join ZeroTier** because the repo had no secrets. All seven are now set (`ZEROTIER_NETWORK_ID`, `ZEROTIER_CENTRAL_TOKEN`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` = `/home/obn/projects/stryde`, `DEPLOY_KNOWN_HOSTS`). The `ZEROTIER_CENTRAL_TOKEN` was pasted into a chat, so consider rotating it. Not yet re-run: the next Deploy should get past Join ZeroTier, then needs section 2.

## 2. Home server not confirmed set up

The deploy needs, on the server:

- [x] Docker usable without `sudo` for `obn` (`docker ps` works over SSH)
- [x] The deploy public key is in `authorized_keys` (key login works)
- [x] ZeroTier joined: server is 192.168.196.25
- [ ] **Where does cloudflared run?** `docker ps` on the server shows no cloudflared container, and the other apps publish on `127.0.0.1:<port>`, so it is probably a host service. `compose.yml` assumes a container on a shared Docker network (`stryde-app:3000`). If it's a host service, compose must publish `127.0.0.1:8173:3000` (8173 looked free) and the tunnel points at `http://localhost:8173`. Check: `systemctl status cloudflared --no-pager | head -5`
- [ ] `/home/obn/projects/stryde/compose.yml` and a filled-in `.env` (`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `TUNNEL_NETWORK` if cloudflared is a container)
- [ ] Image pull access: make the GHCR package `stryde` public, or `docker login ghcr.io` with a `read:packages` token (the package exists once a Deploy build has run; the earlier build pushed it)

## 3. Cloudflare not configured

- [ ] Tunnel public hostname `stryde.obnsolutions.org` → HTTP `stryde-app:3000`
- [ ] Cache rules: bypass for `/api/*`, `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/registerSW.js`
- [ ] Rocket Loader off, Email Address Obfuscation off, Always Use HTTPS on

## 4. Real Google sign-in untested (last Phase 1 item)

Needs a Google Cloud OAuth client (web application) with the origins and redirect URIs from the checklist §7, then `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the server `.env`. Optional for launch: email/username sign-in works.

## 5. Device checks after the first deploy

- [ ] `https://stryde.obnsolutions.org/api/health` shows the latest commit SHA
- [ ] Rollback test (run Deploy with `tag` = an earlier SHA, then with it empty)
- [ ] Install on Android (Chrome) and iPhone (Safari), and log a workout offline then reconnect
- [ ] Database backup cron job (`docker/backup.sh`, see `docs/deploy-home-server.md` §8)

## 6. Decisions waiting on the owner

- [ ] **Phase 9 (notifications, v2)**: start it? It needs HTTPS, VAPID keys on the server and a real phone, so it can't be fully tested before the first deploy.

## Housekeeping (not blocking)

- Phase 8 (social) is built and tested locally but not pushed. Pushed 2026-11-03: backup script, ZeroTier bump, inline PR chip. Deploy will fail at "Join ZeroTier" again until blocker 1 is fixed; CI should pass.
- The ZeroTier action is now `@v1.0.3`. Its post step (`util/post@main`) still targets an old Node runtime, so the deprecation warning stays; GitHub forces it onto Node 24 and it doesn't fail the run.
