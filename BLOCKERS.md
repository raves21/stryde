# Blockers

What stops Stryde from going live, as of 2026-11-03. None of these are code bugs: v1 (Phases 0–7) is built and tested locally. Step-by-step instructions are in [`docs/owner-checklist.md`](docs/owner-checklist.md) and [`docs/deploy-home-server.md`](docs/deploy-home-server.md).

## 1. First deploy fails: no GitHub secrets (blocks Phase 7 acceptance)

Deploy run [#40649038374](https://github.com/raves21/stryde/actions/runs/40649038374) failed at the **Join ZeroTier** step. `gh secret list` shows the repo has no secrets or variables. The image build passed, and every step after Join ZeroTier was skipped.

Secrets to add (repo → Settings → Secrets and variables → Actions, or `gh secret set <NAME> --repo raves21/stryde`):

| Secret | Value |
| --- | --- |
| `ZEROTIER_NETWORK_ID` | the ZeroTier network ID |
| `ZEROTIER_CENTRAL_TOKEN` | ZeroTier Central → Account → API Access Tokens |
| `DEPLOY_HOST` | the server's ZeroTier IP |
| `DEPLOY_USER` | SSH user on the server |
| `DEPLOY_SSH_KEY` | private key of the deploy key pair |
| `DEPLOY_PATH` | absolute app folder, e.g. `/home/<user>/apps/stryde` |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <zerotier-ip>` |

No variables are needed (`APP_URL` and `DOCKER_PLATFORMS` have defaults).

## 2. Home server not confirmed set up

The deploy needs, on the server:

- [ ] Docker usable without `sudo` for the deploy user
- [ ] A Docker network shared with `cloudflared` (`cf_tunnel` or similar)
- [ ] `~/apps/stryde/compose.yml` and a filled-in `.env` (`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `TUNNEL_NETWORK`)
- [ ] The deploy public key in `authorized_keys` (`ssh-copy-id`)
- [ ] ZeroTier joined, with its IP noted
- [ ] Image pull access: make the GHCR package `stryde` public, or `docker login ghcr.io` with a `read:packages` token

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
