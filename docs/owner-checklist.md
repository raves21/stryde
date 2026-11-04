# Owner checklist: what's left on your side

Everything in the repo for v1 (Phases 0–7) is built and tested locally. These steps need your accounts, your server, or a decision from you. Work top to bottom; the details for each step are in [`deploy-home-server.md`](deploy-home-server.md) (section numbers in brackets).

## 1. Server (one time) [§2]

- [ ] Make sure the deploy user can run Docker without `sudo` (`sudo usermod -aG docker <user>`, then log out and back in).
- [ ] Check that port 8173 is free on the server (`ss -ltn | grep :8173`). cloudflared runs on the host and forwards to `127.0.0.1:8173`.
- [ ] Create the app folder and copy the two files from the repo:
  - `docker/compose.yml` → `/home/obn/projects/stryde/compose.yml`
  - `docker/.env.example` → `/home/obn/projects/stryde/.env`
- [ ] Fill in `/home/obn/projects/stryde/.env`, then `chmod 600 .env`:
  - `POSTGRES_PASSWORD` = output of `openssl rand -hex 24`
  - `BETTER_AUTH_SECRET` = output of `openssl rand -base64 32`
  - `APP_PORT` = `8173` (or another free port)
  - `PUBLIC_URL` stays `https://stryde.obnsolutions.org`
- [x] Note the server's ZeroTier IP (192.168.196.25).

## 2. Deploy key [§5]

- [x] Done 2026-11-04. On your machine:
  ```sh
  ssh-keygen -t ed25519 -C "stryde-deploy" -f stryde_deploy -N ""
  ssh-copy-id -i stryde_deploy.pub <user>@<zerotier-ip>
  ssh-keyscan <zerotier-ip>        # copy the output for DEPLOY_KNOWN_HOSTS
  ```

## 3. GitHub (repo → Settings → Secrets and variables → Actions) [§5]

- [ ] Secrets:
  - [x] `ZEROTIER_NETWORK_ID`
  - [x] `ZEROTIER_CENTRAL_TOKEN` (ZeroTier Central → Account → API Access Tokens)
  - [x] `DEPLOY_HOST` (the server's ZeroTier IP)
  - [x] `DEPLOY_USER`
  - [x] `DEPLOY_SSH_KEY` (contents of the private key `stryde_deploy`; delete the local copy afterwards)
  - [x] `DEPLOY_PATH` (absolute path, e.g. `/home/<user>/apps/stryde`)
  - [ ] `DEPLOY_KNOWN_HOSTS` (the `ssh-keyscan` output)
- [ ] Variables: none needed. `APP_URL` defaults to `https://stryde.obnsolutions.org` and `DOCKER_PLATFORMS` to `linux/amd64`.
- [ ] Optional: Settings → Environments → `production` → add yourself as a required reviewer if you want to approve each deploy.

## 4. Cloudflare [§3]

- [ ] Zero Trust → Networks → Tunnels → your tunnel → Public Hostname: `stryde.obnsolutions.org` → **HTTP** `localhost:8173`, on the tunnel served by `cloudflared-ravesdev`.
- [ ] Caching → Cache Rules: for hostname `stryde.obnsolutions.org`, **bypass cache** when the path starts with `/api/` or is `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/registerSW.js`.
- [ ] Speed → Optimization: **Rocket Loader off**.
- [ ] Scrape Shield: **Email Address Obfuscation off**.
- [ ] SSL/TLS → Edge Certificates: **Always Use HTTPS on**.

## 5. First deploy

- [ ] Tell me to push (or push `main` yourself). CI runs, then Deploy builds the image, pushes it to GHCR, deploys it and waits for the health check.
- [ ] If the server can't pull the image: either make the GHCR package `stryde` public, or on the server run `docker login ghcr.io -u raves21` with a token that has `read:packages` [§2.3]. Then rerun Deploy from the Actions tab.
- [ ] Open `https://stryde.obnsolutions.org/api/health`. It should show the latest commit SHA.
- [ ] Set up the database backup cron job with `docker/backup.sh` [§8], and copy the dumps off the server.

## 6. Check it works

- [ ] Rollback test: Actions → Deploy → Run workflow → `tag` = an earlier commit SHA. Health should show that SHA. Then run it again with the tag empty to return to `main`.
- [ ] Android (Chrome): open the site → Profile → Install app (or the browser's install prompt). It should open full screen.
- [ ] iPhone (Safari): Share → Add to Home Screen. It should open full screen.
- [ ] On a phone: log a workout in airplane mode, then reconnect. It should sync (the green dot in the top bar).

## 7. Google sign-in (optional) [§4]

- [ ] Google Cloud Console → Credentials → OAuth client ID (Web application):
  - Authorized JavaScript origins: `https://stryde.obnsolutions.org` (and `http://localhost:5173` for dev)
  - Authorized redirect URIs: `https://stryde.obnsolutions.org/api/auth/callback/google` (and `http://localhost:5173/api/auth/callback/google`)
- [ ] Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the server's `.env`, then run `docker compose up -d app`.
- [ ] Try "Continue with Google". This closes the last open Phase 1 item.

## 8. Decisions I need from you

- [ ] **Phase 9 (notifications)**: start it? It needs HTTPS, VAPID keys on the server and a real phone, so full testing waits for the first deploy. (Phase 8, social, is built and tested locally; it ships with the next push.)

## Notes

- Local `docker build` stalls on this machine (Docker's build network, likely ZeroTier's MTU); use `docker build --network host -f docker/Dockerfile .` if you build by hand. GitHub's runners aren't affected.
- If port 3000 is taken locally (your ticketing Nuxt server), run Stryde with `PORT=3001 STRYDE_API_PORT=3001 bun run dev`.
