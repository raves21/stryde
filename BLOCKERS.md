# Blockers

What is still open, as of 2026-11-04. Nothing here blocks the app running: Phases 0–8 are live at https://stryde.obnsolutions.org and deploys are green. Step-by-step instructions are in [`docs/owner-checklist.md`](docs/owner-checklist.md) and [`docs/deploy-home-server.md`](docs/deploy-home-server.md).

## Done

GitHub secrets, home server (Docker, SSH key, ZeroTier, `/home/obn/projects/stryde`), cloudflared (`cloudflared-obn`, hostname → `localhost:8173`, DNS record), public GHCR package, first deploys (v1, then Phase 8), deploy health check moved to the server (Cloudflare answers GitHub's runners with 403).

## 1. Phase 9 (notifications) is built locally, not live

The code is committed locally and not pushed. To turn it on:
- [ ] Say go to push it (CI + Deploy run automatically).
- [ ] On your machine: `bun run gen:vapid`. Put the three `VAPID_*` lines in `/home/obn/projects/stryde/.env` on the server (`VAPID_SUBJECT=mailto:` an address you own), then `docker compose up -d app`. Keep the private key out of chats.
- [ ] On each phone: Settings → Notifications → Enable. iPhone: only works from the Home Screen app.
- [ ] Check each trigger on real devices: friend finishes a workout, reaction, friend request and accept, rest-timer alert with the phone locked, tapping a notification opens the right screen.

## 2. Cloudflare rules for `stryde.obnsolutions.org`

`sw.js` is currently served with `max-age=14400`, so phones can keep an old service worker for up to 4 hours. Scope everything to the hostname (the zone also serves your other apps):
- [ ] Cache Rule: bypass cache for `/api/*`, `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/registerSW.js`
- [ ] Cache Rule: Browser TTL = Respect origin TTL (not the zone-wide setting)
- [ ] Configuration Rule: Rocket Loader off, Email Address Obfuscation off, Always Use HTTPS on
- [ ] Verify: `curl -sI https://stryde.obnsolutions.org/sw.js | grep -i cache-control` shows `no-cache`

## 3. Real Google sign-in untested (last Phase 1 item)

- [ ] Create the OAuth client (steps in the chat history and `docs/deploy-home-server.md` §4), put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in the server `.env`, `docker compose up -d app`, try "Continue with Google". Optional: email/username sign-in works without it.

## 4. Checks after deploys

- [ ] Rollback test: run Deploy with `tag` = an earlier commit SHA, then with it empty
- [ ] Install on Android (Chrome) and iPhone (Safari), log a workout offline, reconnect
- [ ] Database backup cron job (`docker/backup.sh`, `docs/deploy-home-server.md` §8) and copy the dumps off the server
- [ ] Optional: rotate the ZeroTier API token (it was pasted into a chat)

## 5. Decisions waiting on the owner

- [ ] Phase 10 (VPS deployment guide, docs only): wanted?

## Housekeeping (not blocking)

- The ZeroTier action is `@v1.0.3`. Its post step still targets an old Node runtime, so a deprecation warning stays; GitHub forces Node 24 and it doesn't fail the run.
- The deploy's public-URL check is informational and logs a 403 from GitHub's runners; that is expected.
