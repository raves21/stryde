# Product Spec — Stryde

> Single source of truth for **what** the app does. Both the coding agent and the UI agent read this first.
> Related docs: `IMPLEMENTATION_PLAN.md` (how to build it), `DATA_MODEL_AND_SYNC.md` (schema + sync protocol), `UI_DESIGN.md` (look & feel), `AGENTS.md` (rules for AI agents).

---

## 1. What this is

A personal workout tracker, built as an installable **PWA**, for one lifter and ~20 friends.

- Log workouts → exercises → sets (weight, reps, RIR / to-failure).
- See progress per exercise as charts, with automatic PR detection.
- See a calendar of which days you trained.
- A *minimal* social layer: when a friend finishes a workout, you get notified and it shows in a feed. You can react with an emoji. No posts, no comments.
- Works **fully offline** (gyms have bad signal) and syncs when back online.
- Self-hosted. Only allowed external dependency: Google OAuth (for "Sign in with Google") and the browser vendors' push services (unavoidable for Web Push).

### Primary user's training style (important context)
The owner trains **to failure or close to failure**. Most sets are not "3×10"; they're "go until failure" or "stop at 2 RIR", and the actual reps achieved is what gets logged. Progress = more reps or more weight at the same effort. The app must make this style first-class, not an afterthought.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Exercise** | A movement, e.g. "Bench Press". Either a **preset** (shared, read-only) or **custom** (owned by a user). Has a type: `weighted`, `bodyweight`, `timed`. |
| **Template** | A reusable workout plan, e.g. "Push Day": ordered exercises + planned sets. |
| **Session** (a.k.a. Workout) | One actual performed workout with start and finish time. May come from a template or be freeform. |
| **Set** | One set inside a session exercise. Has a *target* (what was planned) and *actuals* (what happened). |
| **Set type** | `warmup` or `working`. Warm-ups are excluded from progress charts and PRs. |
| **Target kind** | `fixed` (aim for N reps), `rir` (stop at N reps in reserve), `failure` (go to failure). |
| **RIR** | Reps In Reserve. How many more reps you could have done. Failure = 0 RIR. |
| **Superset** | 2+ exercises performed back-to-back, grouped together. Displayed as A1/A2, B1/B2… |
| **e1RM** | Estimated one-rep max. See §6. |
| **PR** | Personal record. See §6. |
| **Feed event** | Created when a shared session is finished. Friends see it in their feed. |

---

## 3. Users, accounts, friends

- **Open signup.** Methods: email + password, or **Sign in with Google**.
- Every user has a unique **username** (lowercase, 3–20 chars, `a-z0-9_`) and a display name. Login works with email *or* username + password.
- Google sign-ups pick a username during onboarding.
- **No email sending in v1** (no SMTP). So: no email verification, no password reset by email. Documented limitation; Google login is the fallback. (Possible later: self-hosted SMTP.)
- **Friendships are mutual**: send a request by username → other user accepts/declines. Either side can remove the friend.
- Friends can see each other's **shared** sessions **in full detail** (exercises, sets, weights, reps, RIR, notes).

### Privacy
- Each session has a toggle **"Share with friends"** (default: on, configurable default in settings).
  - On → when finished, a feed event is created and friends get notified.
  - Off → session is private: no feed event, no notification, friends cannot view it.
  - Toggling it later updates visibility retroactively (turning it off hides the feed event; turning it on creates the feed event but does **not** send a notification).
- Profile/stats of non-friends are not visible. Searching by username only returns username + display name + avatar.

---

## 4. Features

### 4.1 Exercise library
- Ship ~60–100 **preset exercises** (seeded) covering major movements, each with name, type, primary muscle group, equipment.
- Users can create **custom exercises** (name, type, muscle group, equipment). Editable/deletable by owner. Deleting a custom exercise that has history → soft-delete (archived), history remains.
- Search + filter by muscle group.

Exercise types and what a set records:

| Type | Fields logged | Example |
|---|---|---|
| `weighted` | weight + reps | Bench Press |
| `bodyweight` | reps + optional added weight | Pull-up, Dip |
| `timed` | duration (seconds) + optional weight | Plank |

### 4.2 Templates
- Create / edit / duplicate / delete templates.
- A template = ordered list of exercises; each has planned sets with: set type, target kind, target reps (or rep range) for `fixed`, target RIR for `rir`, optional planned weight, rest time.
- Exercises can be grouped into **supersets**.
- Starting a workout from a template copies it into a new session (later template edits don't affect past sessions).

### 4.3 Logging a workout (the core flow; must be fast and reliable)
- Start from a template **or** start empty and add exercises as you go.
- Only **one active session** at a time. Active session survives app kill / reload / offline.
- Each set row shows: set number, type badge (W for warm-up), **"previous"** value (what you did in the same set position last time for this exercise), weight input, reps input, RIR input (when relevant), complete checkbox.
- **Pre-fill rules:**
  - `fixed` sets: weight pre-filled from previous/template; reps pre-filled with target. Completing = tap checkbox.
  - `rir` / `failure` sets: weight pre-filled; **reps left empty** (previous shown as placeholder hint). User **must enter actual reps** before the set can be completed. For `rir` sets, actual RIR defaults to target and is editable. For `failure` sets, RIR = 0.
- Add/remove sets, add/remove/reorder exercises, convert to superset, change a set's type/target on the fly.
- **Rest timer**: auto-starts when a working set is completed (duration from exercise/template, default from settings, e.g. 120 s). Adjustable ±15 s, skippable. Notifies when done, including when the app is backgrounded (needs network; see implementation plan).
- Workout timer shows elapsed time (computed from `started_at`, never from an interval counter).
- Workout-level **notes** (free text).
- **Finish**: summary sheet (duration, sets, volume, PRs achieved), notes, "Share with friends" toggle → Save. Unfinished sets are discarded (with a warning listing them) or user can go back.
- **Discard workout** with confirmation.
- Finished sessions can be **edited** later (sets, notes, times, share toggle).

### 4.4 History & calendar
- **Calendar view**: binary "trained / didn't train" per day. *No intensity shading.* Two views:
  - **Year grid** (GitHub-style squares, 53 weeks × 7 days): filled = trained, empty = not.
  - **Month calendar**: days with a check mark; tap a day → list of sessions that day.
- **History list**: reverse chronological sessions; tap → session detail.
- Day attribution uses the session's **local date at start time** (see data model).

### 4.5 Progress & analytics
Per exercise (exercise detail screen):
- Charts over time (one point per session, warm-ups excluded):
  - `weighted`: **e1RM** (default), **best set** (weight × reps), **session volume**.
  - `bodyweight`: **max reps in a set**, **total reps**, (e1RM using added weight if used).
  - `timed`: **longest duration**.
- Time range filter: 1M / 3M / 6M / 1Y / All.
- **PR list** for the exercise (each PR type with value + date).
- History of this exercise's sets per session.

Global analytics (Progress tab):
- Workouts this week / this month / this year.
- Calendar (year grid + month).
- **Recent PRs** list.
- Total sessions, total volume (lifetime and this month).

### 4.6 Social
- **Feed**: friends' shared, finished sessions, newest first. Card shows: friend, workout name, finished time, **duration**, number of exercises/sets, **PR badges** if any, reactions.
- Tap → full session detail (read-only).
- **Reactions**: one tap from a fixed set: 💪 🔥 👏 🏆 😤. One reaction per user per session (tapping another replaces it; tapping same removes it). Shows counts + who reacted.
- Your own finished shared sessions also appear in your feed (so you see reactions).
- Friends screen: friend list, incoming/outgoing requests, add by username.

### 4.7 Notifications (Web Push + in-app)
Types:
| Type | Trigger |
|---|---|
| `friend_workout_finished` | Friend finishes a shared session (includes PR count if any) |
| `reaction_received` | Someone reacts to your session |
| `friend_request` | Incoming request |
| `friend_accepted` | Your request was accepted |
| `rest_timer_done` | Your rest timer ended (only while a session is active) |

Settings:
- **Mute all** (master switch).
- Per-type toggles.
- **Mute specific friends** (their workouts don't notify you; they still appear in feed).
- Stale rule: a workout finished offline and synced **more than 60 min after `finished_at`** goes to the feed but sends **no** push.

In-app: a notifications list (bell) with unread count.

### 4.8 Settings
- Units: **kg (default)** or lb. Stored canonically as kg; display-converted.
- Default rest time.
- Default "Share with friends" value for new sessions.
- Notification settings (above).
- Profile: display name, username, avatar (upload, stored on server volume; or generated initials avatar).
- Sync status (last synced, pending changes count), "sync now".
- Install guide (Add to Home Screen; required for iOS push).
- Sign out (warn if unsynced changes exist).

---

## 5. Offline requirements
- Everything about **your own data** works fully offline: start/log/finish/edit workouts, templates, custom exercises, calendar, charts, PRs, settings.
- **Offline priority is workout data only.** Social features (feed, friends' sessions, reactions, friends, notifications list) are **online-only**: nothing social is cached or persisted on the device, and nothing social is queued while offline. When offline, social screens show a simple "You're offline" state.
- Things that need network: signup/login, everything social (feed, reactions, friend requests, notifications list), push delivery, rest-timer notification while app is backgrounded.
- UI always shows sync state (synced / syncing / offline with N pending).
- No data loss: closing the app mid-workout or while offline loses nothing.

---

## 6. Calculations (must be implemented in one shared module, tested)

Working, completed sets only (warm-ups excluded everywhere below).

- **Effective reps** = `reps + (rir ?? 0)` (a set to failure has RIR 0).
- **e1RM** (Epley, RIR-adjusted) = `weight × (1 + effectiveReps / 30)`; if `reps == 1 && rir == 0` → `weight`. Only computed when `effectiveReps <= 15`; otherwise null (inaccurate).
  - For bodyweight with added weight, `weight` = added weight (e1RM only shown if added weight > 0).
- **Best set** = set with highest e1RM in the session (fallback: highest weight, then reps).
- **Session volume** (per exercise) = Σ `weight × reps`.
- **PR types** (per exercise):
  - `e1rm` — highest e1RM ever
  - `weight` — heaviest weight completed for ≥1 rep
  - `reps_at_weight` — most reps at a given weight (or heavier)
  - `volume` — highest single-session volume
  - `max_reps` (bodyweight, no added weight)
  - `duration` (timed)
- **First-ever session for an exercise sets baselines, not PRs** (avoid PR spam).
- PRs are recomputed when past sessions are edited/deleted.

---

## 7. Non-goals (v1)
Comments/posts, public profiles, streaks/weekly goals, bodyweight log, data export, light mode, plate calculator, assisted-exercise type, drop sets/circuits (supersets only), Apple Health / Google Fit, email sending.

## 8. Release slicing
- **v1 (MVP):** auth, exercises, templates, logging (incl. supersets, rest timer in-app), offline + sync, history, calendar, charts, PRs, settings, Docker + CI/CD.
- **v2:** friends, feed, reactions, privacy toggle effects, Web Push, SSE live updates, rest-timer push.
