# Deploying Stryde to the home server

Stryde runs as two containers on the home server: **app** (Bun: the API plus the built web app, one image from GHCR) and **db** (Postgres 17). Your existing **cloudflared** service (running on the host) exposes the app at `https://stryde.obnsolutions.org`; the app listens on `127.0.0.1:8173` only, so nothing is reachable from the network except through the tunnel.

```
phone ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared (host service) ──▶ 127.0.0.1:8173 → app:3000
                                                                                        │
                                                                         (network internal) ▼
                                                                                      db:5432
GitHub: push to main → CI → Deploy: build image → GHCR → ZeroTier + SSH → docker compose pull/up → /api/health = new SHA
```

Files in the repo:

| File | Purpose |
|---|---|
| `docker/Dockerfile` | Multi-stage image (`oven/bun:1.3.14-alpine`), non-root, healthcheck |
| `docker/compose.yml` | Production stack, copied to the server as `compose.yml` |
| `docker/.env.example` | Every environment variable, copied to the server as `.env` |
| `.github/workflows/ci.yml` | Typecheck, lint, unit + integration tests (Postgres service), build, e2e |
| `.github/workflows/deploy.yml` | Build + push image, deploy over ZeroTier/SSH, verify, rollback |

---

## 1. Prerequisites

- The server runs Docker Engine with the Compose plugin (`docker compose version`), on **amd64** (the image is built for `linux/amd64`; change the `DOCKER_PLATFORMS` variable if that ever changes).
- The server is a member of your ZeroTier network and you know its ZeroTier IP (`zerotier-cli listnetworks` on the server, or ZeroTier Central).
- `cloudflared` runs on the host (here: the `cloudflared-ravesdev` systemd service) and serves a tunnel you manage in Cloudflare Zero Trust.
- The repository is on GitHub (`raves21/stryde`) with Actions enabled.

## 2. One-time server setup

### 2.1 A user that can deploy

Use your normal user or a dedicated `deploy` user. It must be able to run Docker without sudo:

```sh
sudo usermod -aG docker "$USER"   # log out and back in afterwards
```

### 2.2 The port cloudflared forwards to

cloudflared runs on the host, so it reaches Stryde through a port on `127.0.0.1` (compose publishes `127.0.0.1:${APP_PORT}:3000`; nothing is exposed on other interfaces). Pick a port nothing else uses:

```sh
ss -ltn | grep -E ':8173\b' || echo "8173 is free"
```

If it's taken, choose another and set `APP_PORT` in `.env` (and use it in the Cloudflare hostname in §3.1).

### 2.3 Pulling from GHCR

The image is `ghcr.io/raves21/stryde`. Either:

- make the package **public** (GitHub → your profile → Packages → `stryde` → Package settings → Change visibility); nothing else is needed. Or:
- keep it private and log in once on the server with a classic personal access token that has only `read:packages`:

  ```sh
  echo <token> | docker login ghcr.io -u raves21 --password-stdin
  ```

The package appears after the first successful Deploy run.

### 2.4 The app directory

```sh
mkdir -p ~/apps/stryde && cd ~/apps/stryde
# From your machine (or copy the files from GitHub):
scp docker/compose.yml      <user>@<server>:~/apps/stryde/compose.yml
scp docker/.env.example     <user>@<server>:~/apps/stryde/.env
```

Fill in `~/apps/stryde/.env`:

| Variable | Value |
|---|---|
| `IMAGE_TAG` | `latest` for the first start; the deploy workflow then writes the commit SHA here |
| `PUBLIC_URL` | `https://stryde.obnsolutions.org` (no trailing slash). Must match the hostname exactly, or sign-in fails with "Invalid origin" |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Changing it later signs everyone out |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional, see §4 |
| `APP_PORT` | Host port on `127.0.0.1` for cloudflared, §2.2 (`8173` by default) |
| `UPLOAD_DIR` | Leave `/data/uploads` (a volume) |

`DATABASE_URL` is built by `compose.yml` from `POSTGRES_PASSWORD`; don't set it. `GIT_SHA` comes from the image.

```sh
chmod 600 .env
```

### 2.5 First start

```sh
cd ~/apps/stryde
docker compose up -d
docker compose ps                 # app should become "healthy" within ~30 s
docker compose logs -f app        # "api listening on http://localhost:3000"
```

Migrations and the preset exercise seed run automatically every time the app starts.

## 3. Cloudflare

### 3.1 Public hostname

Zero Trust → Networks → Tunnels → your tunnel → **Public Hostname** → Add:

- Subdomain `stryde`, domain `obnsolutions.org`
- Service: **HTTP**, URL `localhost:8173` (your `APP_PORT`)

(For a locally managed tunnel, add the same as an `ingress` rule in cloudflared's `config.yml`: `hostname: stryde.obnsolutions.org`, `service: http://localhost:8173`. The domain must be a zone in the Cloudflare account that owns the tunnel.)

Open `https://stryde.obnsolutions.org/api/health`: you should see `{"ok":true,"version":"<sha>"}`.

### 3.2 Caching and rewriting

The app already sends the right `Cache-Control` headers (`no-cache` for `index.html`, `sw.js`, `manifest.webmanifest`, `registerSW.js`; a year, immutable, for hashed `/assets/*`). Make sure Cloudflare doesn't override them, for the `stryde.obnsolutions.org` hostname:

1. **Caching → Cache Rules** → create a rule *"Stryde: bypass"*: when *Hostname equals `stryde.obnsolutions.org`* **and** (*URI Path starts with `/api/`* **or** *URI Path is in `/sw.js` `/index.html` `/manifest.webmanifest` `/registerSW.js` `/`*) → **Bypass cache**.
2. **Speed → Optimization**: turn **Rocket Loader off** (it rewrites scripts and breaks the service worker). If your plan still shows Auto Minify, leave it off.
3. **Scrape Shield**: turn **Email Address Obfuscation off** (it rewrites HTML).
4. **SSL/TLS → Edge Certificates**: **Always Use HTTPS on**. (The tunnel itself handles origin TLS; there's nothing to configure on the server.)

Later (v2, Phase 9): Server-Sent Events need `text/event-stream` responses not to be buffered; the app sends a heartbeat every 25 s because Cloudflare closes idle connections after ~100 s.

## 4. Google sign-in (optional)

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application):

- Authorized JavaScript origin: `https://stryde.obnsolutions.org`
- Authorized redirect URI: `https://stryde.obnsolutions.org/api/auth/callback/google`

For local development add `http://localhost:5173` and `http://localhost:5173/api/auth/callback/google` too (dev runs on that origin).

Put the client ID and secret in the server's `.env`, then `docker compose up -d app`. Without them the Google button reports that Google sign-in isn't set up; email/username sign-in works regardless.

## 5. GitHub configuration

Settings → Secrets and variables → Actions.

**Secrets**

| Secret | Value |
|---|---|
| `ZEROTIER_NETWORK_ID` | Your ZeroTier network ID |
| `ZEROTIER_CENTRAL_TOKEN` | A ZeroTier Central API token (Central → Account → API Access Tokens). The action uses it to authorize the runner as a member and removes it after the run |
| `DEPLOY_HOST` | The server's ZeroTier IP |
| `DEPLOY_USER` | The SSH user from §2.1 |
| `DEPLOY_SSH_KEY` | A private key used only for deploys (see below) |
| `DEPLOY_PATH` | `~/apps/stryde` written as an absolute path, e.g. `/home/<user>/apps/stryde` |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan <zerotier-ip>` run from a trusted machine on the ZeroTier network (pins the host key; without it the workflow trusts the key on first use and warns) |

A dedicated deploy key:

```sh
ssh-keygen -t ed25519 -C "stryde-deploy" -f stryde_deploy -N ""
ssh-copy-id -i stryde_deploy.pub <user>@<zerotier-ip>     # adds it to authorized_keys
# Paste the contents of `stryde_deploy` (the private key) into DEPLOY_SSH_KEY, then delete the local copy.
```

**Variables** (optional)

| Variable | Default | Purpose |
|---|---|---|
| `APP_URL` | `https://stryde.obnsolutions.org` | Where the deploy job checks `/api/health` |
| `DOCKER_PLATFORMS` | `linux/amd64` | Image platforms |

**Environment**: the deploy job uses an environment named `production` (Settings → Environments). It's created automatically on the first run; add required reviewers there if you want to approve each deploy.

## 6. Deploying

- **Automatic:** merge or push to `main`. CI runs; when it passes, **Deploy** builds the image (tags `latest` and the commit SHA), pushes it to GHCR, joins ZeroTier, SSHes in, sets `IMAGE_TAG=<sha>` in `.env`, runs `docker compose pull app && docker compose up -d app`, prunes old images, and waits until `https://stryde.obnsolutions.org/api/health` reports the new SHA (the job fails after ~2 minutes otherwise).
- **Manual:** Actions → Deploy → Run workflow, leave `tag` empty to build and deploy the current `main`.

Updates reach phones safely: the app shows "Update available — Reload" and never reloads during an active workout.

## 7. Rolling back

Actions → Deploy → **Run workflow** → `tag` = the full commit SHA of a previous good deploy (from the Deploy run history, `git log`, or the GHCR package's versions). Nothing is rebuilt; the server switches to that image and the health check confirms it.

Migrations only move forward: rolling back the app past a release that changed the database schema needs care. The migrations in this repo are additive so far.

By hand on the server, the same thing:

```sh
cd ~/apps/stryde
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha>/' .env
docker compose pull app && docker compose up -d app
```

## 8. Operating it

```sh
cd ~/apps/stryde
docker compose ps                         # status and health
docker compose logs -f app                # app logs
docker compose restart app                # restart
docker compose up -d app                  # apply .env changes
docker compose exec db psql -U stryde     # SQL shell
```

**Backups.** `docker/backup.sh` dumps the database to `~/apps/stryde/backups/` (checks the dump can be read back, keeps 14 days; override with `BACKUP_DIR` / `KEEP_DAYS`). Copy it next to `compose.yml` and schedule it:

```sh
cp backup.sh ~/apps/stryde/ && chmod +x ~/apps/stryde/backup.sh   # from docker/ in the repo
~/apps/stryde/backup.sh                                            # run once by hand to check
crontab -e
# 30 3 * * * /home/<user>/apps/stryde/backup.sh >> /home/<user>/apps/stryde/backups/backup.log 2>&1
```

A backup on the same disk doesn't survive a dead disk: also copy `backups/` somewhere else (another machine over ZeroTier with `rsync`, or a cloud drive).

Restore into a fresh stack:

```sh
docker compose up -d db
docker compose exec -T db pg_restore -U stryde -d stryde --clean --if-exists < stryde-YYYY-MM-DD.dump
docker compose up -d app
```

Phones keep their own copy of their data and their unsynced changes, so a short server outage loses nothing: they sync when it's back.

## 9. Web Push keys (v2)

Phase 9 adds notifications. Then run `bun run gen:vapid` locally, put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=mailto:<you>` in the server's `.env`, and `docker compose up -d app`. iPhones only receive pushes when Stryde is installed to the Home Screen.

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| Cloudflare 502 / "Bad gateway" | `docker compose ps` (is app healthy?); the hostname's service is `http://localhost:<APP_PORT>` and `curl -s localhost:<APP_PORT>/api/health` works on the server |
| Sign-in fails, logs say "Invalid origin" | `PUBLIC_URL` must be exactly `https://stryde.obnsolutions.org` |
| Deploy job: "Server not reachable over ZeroTier" | `ZEROTIER_NETWORK_ID`/`ZEROTIER_CENTRAL_TOKEN`; the server is online in Central; flow rules allow SSH (22) from new members |
| Deploy job: health check never reports the SHA | `docker compose logs app` on the server (migration or env error); `.env` has an `IMAGE_TAG=` line; Cloudflare isn't caching `/api/*` |
| `docker compose pull` denied | GHCR package is private and the server isn't logged in (§2.3) |
| Phones keep an old version | They show "Update available" on the next visit; `sw.js` and `index.html` must not be edge-cached (§3.2) |
| Local `docker build` hangs downloading packages | A local Docker network issue (seen with ZeroTier's MTU): build with `docker build --network host -f docker/Dockerfile .` |

## 11. Fallback: self-hosted runner

If ZeroTier from GitHub's runners is ever a problem, install a [self-hosted GitHub Actions runner](https://docs.github.com/en/actions/hosting-your-own-runners) on the server (for a **private** repo only: a public repo would let anyone's pull request run code on your server). Then change the deploy job to `runs-on: self-hosted`, drop the ZeroTier and SSH steps, and run the deploy commands directly in `DEPLOY_PATH`.
