# Phase 8 — Social: Friends, Feed, Reactions

> Release: **v2** · Depends on: Phase 7 · Next: `phase-09-notifications.md`
> References: `PRODUCT_SPEC.md` §3 (privacy), §4.6, §5; `DATA_MODEL_AND_SYNC.md` §3, §6, §7; `UI_DESIGN.md` §5.6, §5.11–5.12.

## Key rule
**Social is online-only.** Fetch with TanStack Query (in-memory cache only, **no persister**), never store in Dexie, never queue in the outbox. Offline → show the offline state and disable social actions.

## Tasks

### 1. Server: friendships
- Endpoints per `DATA_MODEL_AND_SYNC.md` §7: search users by username (prefix, max 10, returns only username/displayName/avatar), send request, accept/decline, remove friend, list friends, list requests (incoming/outgoing), mute/unmute friend.
- Unique unordered pair; sending a request to someone who already requested you auto-accepts.
- Authorization helper `canViewSession(viewerId, session)` = owner OR (accepted friends AND `shareWithFriends` AND finished AND not deleted). Unauthorized → **404**.

### 2. Server: feed events (fill the `onSessionsChanged` hook)
- Per `DATA_MODEL_AND_SYNC.md` §6: create feed event on first sync of a finished shared session (`createdAt = finishedAt`); hide when unshared/deleted; unhide on reshare. Store PR summary from Phase 5.
- Notification enqueueing is Phase 9; leave a call to `notify.friendWorkoutFinished(...)` as a no-op if Phase 9 isn't done.

### 3. Server: feed & session detail
- `GET /api/feed?before=&limit=20`: self + accepted friends, non-hidden, newest first, with actor profile, session name, duration, exercise/set counts, PRs, reaction counts by emoji, and my reaction.
- `GET /api/sessions/:id`: full detail incl. exercise names (also friends' custom exercises) if `canViewSession`.
- Efficient queries (join/aggregate; avoid N+1).

### 4. Server: reactions
- `PUT /api/sessions/:id/reaction { emoji }` (create or replace), `DELETE /api/sessions/:id/reaction`, `GET /api/sessions/:id/reactions` (who reacted). Requires `canViewSession`. Stored in the server-only `reactions` table.

### 5. Web: screens (built with shadcn/ui)
- `/feed`: `FeedCard` list with infinite scroll (`useInfiniteQuery`), pull-to-refresh, empty state ("Add friends…"), offline state.
- Friend session detail: reuse session detail component in read-only "friend" mode with owner header and `ReactionBar`.
- `ReactionPicker` (shadcn `Popover`), optimistic update + rollback on error; "who reacted" `Drawer`.
- `/friends`: shadcn `Tabs` (Friends / Requests), username search, friend rows with `DropdownMenu` (Mute notifications / Remove), request rows with Accept/Decline.
- Share toggle on own session detail now visibly affects the feed.
- Refetch social queries on reconnect (`onlineManager`) and on window focus.

## Tests
- Authorization: non-friend, pending friend, private session, deleted session → 404.
- Feed contents: own + friends only, hidden excluded, ordering by `finishedAt`, pagination.
- Late sync: a session finished 3 h ago appears with the correct time.
- Reaction replace/remove semantics; reacting to an invisible session → 404.
- Playwright: two users befriend each other; user A finishes a shared workout; user B sees it with duration + PRs and reacts; private workout never appears.

## Acceptance criteria
- [ ] All tests pass.
- [ ] Feed/friends show the offline state when offline, with no stale cached data.
- [ ] All checks green.
