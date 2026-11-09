# Running Stryde locally

How to run the whole app (API + web + Postgres) on your machine and try it in a browser. About five minutes the first time.

## What you need

- **Bun** 1.3.14 or newer (`bun --version`). It runs the API, installs packages and runs the scripts.
- **Docker** with the Compose plugin, only for the Postgres database.
- A Chromium-based browser (Chrome, Edge, Brave) is best for testing the PWA bits.
- Free ports: **3000** (API), **5173** (web), **5432** (Postgres). If something else uses them, see [Port clashes](#port-clashes).

## First time

```sh
cd stryde
bun install                                              # all workspaces
docker compose -f docker/compose.dev.yml up -d           # Postgres 17 on localhost:5432
bun run dev                                              # API + web together
```

Open **http://localhost:5173**.

No `.env` file is needed: development defaults point at `postgres://stryde:stryde@localhost:5432/stryde`, and `bun run dev` runs the database migrations and loads the 84 preset exercises on start.

Stop it with `Ctrl+C`. The database keeps running in Docker (`docker compose -f docker/compose.dev.yml stop` stops it; `down -v` also deletes its data).

## Using it

1. **Sign up** at `/signup` (any email, a username, a password). There is no email sending, so nothing is verified. Google sign-in shows "isn't set up" unless you add Google credentials (see below).
2. Go through onboarding (units, install, notifications). Notifications can be skipped.
3. Try the main flows: add a **template** (Profile → Templates → New, then **Save**), tap the round **+** to start a workout, log sets, finish it, look at Progress and History.
4. **Friends and the feed** need two accounts. Use two browser profiles, or one normal and one private window, sign up as two users, add each other by username on the Friends screen (Feed → people icon), finish a shared workout in one and watch it appear in the other's feed. Reactions and the bell update live.

### Things that work differently in dev

- **No service worker.** `bun run dev` doesn't register one, so: no offline cold start, no install prompt, no update toast, and **push notifications are unavailable**. The bell, notifications list and live updates (SSE) still work.
- Offline behavior inside an open tab still works (DevTools → Network → Offline), but a page you haven't opened yet won't load. To test real offline and the PWA, use the [production build](#testing-the-production-build-offline-install-service-worker).
- The first load after adding a new dependency can reload once. That is Vite, not the app.

## Demo data for the Feed

An empty feed isn't much to look at, so there is a seed script for your **local** database (it refuses to run against anything that isn't `localhost`):

```sh
bun run seed:dev
```

It creates a `demo` account and five friends (Marco, Aiko, Sam, Lena, Diego) with 14 finished workouts over the last two weeks, some with personal records, plus reactions between them and a pending friend request (Priya). It goes through the real API routes, so the feed, PR badges, friend notifications and the bell all fill in as they would for real.

- Sign in as **`demo`** with password **`correct-horse-battery`** (the friends use the same password).
- **To see it from your own account instead**, sign up in the app first, then: `cd apps/api && bun src/scripts/seed-dev.ts --user <your-username>`. That makes you friends with all five and gives you Priya's pending request. (It doesn't add workouts to your own history.)
- Running it again updates the same rows instead of adding more; the times move forward so "26 minutes ago" stays recent.
- To remove it all: `docker compose -f docker/compose.dev.yml down -v` (wipes the whole dev database), then up again.

## Everyday commands

```sh
bun run dev          # API (bun --watch) + web (Vite) with hot reload
bun run typecheck    # all workspaces
bun run lint         # Biome check;  bun run format  applies fixes
bun run test         # unit tests (Vitest). API integration tests need DATABASE_URL, below
bun run e2e          # Playwright against a production build, own database
bun run build        # build everything
```

Run the tests that touch the database:

```sh
DATABASE_URL=postgres://stryde:stryde@localhost:5432/stryde bun run test
```

They use a separate `stryde_test` database that is dropped and rebuilt every run, so they never touch the data you click around in. Without `DATABASE_URL` the integration tests are skipped.

`bun run e2e` needs the same Postgres running, uses ports 3100 and 5180 and a `stryde_e2e` database. The first time on a machine: `cd apps/web && bunx playwright install chromium`.

## Testing the production build (offline, install, service worker)

The service worker only exists in a production build, so test offline, install and updates like this:

```sh
cd apps/web
bunx vite build && bunx vite preview --port 4173                        # web on :4173
# in another terminal, with the dev database up:
cd apps/api && bun src/index.ts                                         # API on :3000
```

Open http://localhost:4173. (`vite preview` proxies `/api` to the API port, like the dev server does.) For the API to accept sign-ins from that address, start it with `PUBLIC_URL=http://localhost:4173`.

Or just run `bun run e2e`, which does a version of this for you and checks the offline flows.

## Testing on your phone (same Wi-Fi)

Phones need HTTPS for the PWA and push, so for a quick look at layout only:

```sh
# find your computer's LAN address, e.g. 192.168.1.20, then:
cd apps/web && bunx vite --host
```

Open `http://<that address>:5173` on the phone. Sign-in cookies and install won't behave exactly like production (no HTTPS); for the real thing use the deployed site.

## Optional settings

Set these in the shell before `bun run dev` (or in `apps/api/.env`, which Bun loads):

| Variable | Default | Use |
|---|---|---|
| `DATABASE_URL` | `postgres://stryde:stryde@localhost:5432/stryde` | Point at another database |
| `PORT` | `3000` | API port |
| `PUBLIC_URL` | `http://localhost:5173` | The browser origin; must match the address you open, or sign-in fails with "Invalid origin" |
| `STRYDE_API_PORT` | `3000` | Where the Vite dev server proxies `/api` (set it when you change `PORT`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | unset | Turns on Google sign-in. In the Google console allow origin `http://localhost:5173` and redirect URI `http://localhost:5173/api/auth/callback/google` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | unset | Web Push (`bun run gen:vapid` makes a pair). Only useful with the production build |

## Port clashes

If a port is busy (another dev server, another project's Postgres), don't stop it, move Stryde instead:

- **API port busy** (3000): `PORT=3002 STRYDE_API_PORT=3002 bun run dev`
- **Web port busy** (5173): Vite quietly takes the next free port (5174, ...) and prints it. Open that address, and tell the API about it so sign-in works: `PUBLIC_URL=http://localhost:5174 bun run dev`.
- **Postgres busy** (5432): run a second one on another port and point everything at it:
  ```sh
  docker run -d --name stryde-dev-db-alt -p 5433:5432 \
    -e POSTGRES_USER=stryde -e POSTGRES_PASSWORD=stryde -e POSTGRES_DB=stryde postgres:17-alpine
  export DATABASE_URL=postgres://stryde:stryde@localhost:5433/stryde
  bun run dev        # and bun run test / bun run e2e in the same shell
  ```

## Reset and troubleshooting

| Problem | Fix |
|---|---|
| `connection refused` / `password authentication failed` on start | Postgres isn't the Stryde one: `docker compose -f docker/compose.dev.yml up -d`, and check nothing else holds port 5432 (`ss -ltn \| grep 5432`) |
| "Invalid origin" when signing in | `PUBLIC_URL` doesn't match the address in the browser bar |
| Blank page or stale UI after switching between dev and a production build | DevTools → Application → Service Workers → Unregister, then Clear site data |
| Want a clean slate | Sign out and clear site data (this removes the local IndexedDB), and `docker compose -f docker/compose.dev.yml down -v` to wipe the server database |
| App updates never apply in dev | Expected: there is no service worker in dev (updates are automatic only in a production build) |
| Changed a route file and `typecheck` fails | The route tree regenerates when Vite runs: start `bun run dev` or run `cd apps/web && bunx vite build` once |
| Port 3000 busy but you want the defaults | See [Port clashes](#port-clashes) |

More background: `AGENTS.md` (rules and commands), `HANDOVER.md` (gotchas), `docs/deploy-home-server.md` (the real deployment).
