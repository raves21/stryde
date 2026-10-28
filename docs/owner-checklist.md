# Owner checklist: what's left on your side

Everything in the repo for v1 (Phases 0–7) is built and tested locally. These steps need your accounts, your server, or a decision from you. Work top to bottom; the details for each step are in [`deploy-home-server.md`](deploy-home-server.md) (section numbers in brackets).

## 1. Server (one time) [§2]

- [ ] Make sure the deploy user can run Docker without `sudo` (`sudo usermod -aG docker <user>`, then log out and back in).
- [ ] Find the Docker network your `cloudflared` container is on (`docker network ls`, `docker inspect <cloudflared>`). If it's only on `bridge`, create one and attach cloudflared:
  ```sh
  docker network create cf_tunnel
  docker network connect cf_tunnel <cloudflared-container>
  ```
- [ ] Create the app folder and copy the two files from the repo:
  - `docker/compose.yml` → `~/apps/stryde/compose.yml`
  - `docker/.env.example` → `~/apps/stryde/.env`
- [ ] Fill in `~/apps/stryde/.env`, then `chmod 600 .env`:
  - `POSTGRES_PASSWORD` = output of `openssl rand -hex 24`
  - `BETTER_AUTH_SECRET` = output of `openssl rand -base64 32`
  - `TUNNEL_NETWORK` = the network name from above
  - `PUBLIC_URL` stays `https://stryde.obnsolutions.org`
- [ ] Note the server's ZeroTier IP (`zerotier-cli listnetworks`).

## 2. Deploy key [§5]

- [ ] On your machine:
  ```sh
  ssh-keygen -t ed25519 -C "stryde-deploy" -f stryde_deploy -N ""
  ssh-copy-id -i stryde_deploy.pub <user>@<zerotier-ip>
  ssh-keyscan <zerotier-ip>        # copy the output for DEPLOY_KNOWN_HOSTS
  ```

## 3. GitHub (repo → Settings → Secrets and variables → Actions) [§5]

- [ ] Secrets:
  - [ ] `ZEROTIER_NETWORK_ID`
  - [ ] `ZEROTIER_CENTRAL_TOKEN` (ZeroTier Central → Account → API Access Tokens)
  - [ ] `DEPLOY_HOST` (the server's ZeroTier IP)
  - [ ] `DEPLOY_USER`
  - [ ] `DEPLOY_SSH_KEY` (contents of the private key `stryde_deploy`; delete the local copy afterwards)
  - [ ] `DEPLOY_PATH` (absolute path, e.g. `/home/<user>/apps/stryde`)
  - [ ] `DEPLOY_KNOWN_HOSTS` (the `ssh-keyscan` output)
- [ ] Variables: none needed. `APP_URL` defaults to `https://stryde.obnsolutions.org` and `DOCKER_PLATFORMS` to `linux/amd64`.
- [ ] Optional: Settings → Environments → `production` → add yourself as a required reviewer if you want to approve each deploy.

## 4. Cloudflare [§3]

- [ ] Zero Trust → Networks → Tunnels → your tunnel → Public Hostname: `stryde.obnsolutions.org` → **HTTP** `stryde-app:3000`.
- [ ] Caching → Cache Rules: for hostname `stryde.obnsolutions.org`, **bypass cache** when the path starts with `/api/` or is `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/registerSW.js`.
- [ ] Speed → Optimization: **Rocket Loader off**.
- [ ] Scrape Shield: **Email Address Obfuscation off**.
- [ ] SSL/TLS → Edge Certificates: **Always Use HTTPS on**.

## 5. First deploy

- [ ] Tell me to push (or push `main` yourself). CI runs, then Deploy builds the image, pushes it to GHCR, deploys it and waits for the health check.
- [ ] If the server can't pull the image: either make the GHCR package `stryde` public, or on the server run `docker login ghcr.io -u raves21` with a token that has `read:packages` [§2.3]. Then rerun Deploy from the Actions tab.
- [ ] Open `https://stryde.obnsolutions.org/api/health`. It should show the latest commit SHA.
- [ ] Set up a database backup cron job [§8].

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

- [ ] **Inline PR hint during a workout** (`UI_DESIGN.md` §5.4: a gold 🏆 "e1RM PR" chip on a just-completed set). Should I build it, or drop it from the design? PRs already show on the finish sheet, session detail, records and charts.
- [ ] **Phase 8 (social: friends, feed, reactions)**: start it once v1 is deployed, or wait?

## Notes

- Local `docker build` stalls on this machine (Docker's build network, likely ZeroTier's MTU); use `docker build --network host -f docker/Dockerfile .` if you build by hand. GitHub's runners aren't affected.
- If port 3000 is taken locally (your ticketing Nuxt server), run Stryde with `PORT=3001 STRYDE_API_PORT=3001 bun run dev`.
