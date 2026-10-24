# UI Design Brief — Stryde

> For the AI that generates the UI (and the coding agent wiring it up). Read `PRODUCT_SPEC.md` for full feature behavior; this file covers **look, feel, layout, components, and states**.
> Output target: **React + TypeScript + Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react icons + Recharts**. Mobile-first PWA. **Dark mode only.**
> **Build every screen from shadcn/ui components** (see §6.1), restyled with the tokens below. Don't hand-roll buttons, inputs, dialogs, sheets, tabs, switches, menus, or toasts.

---

## 1. Context: who uses this, and where

- A lifter **in the middle of a gym session**: phone in one hand, maybe sweaty, between sets, often with 60–180 s of rest, sometimes with gloves or chalk. Bad signal is common.
- Training style: **sets to failure or a target RIR.** The most frequent action in the whole app is: *finish a set → type how many reps I got → tick it.* That interaction must take **under 3 seconds and two taps plus the number.**
- ~20 friends use it too. The social part is a quiet, motivating feed ("Marco finished Leg Day · 1h 12m · 2 PRs"), not a social network.

**Design goals, in priority order**
1. **Fast, thumb-reachable logging.** Primary actions in the bottom half of the screen. Big targets.
2. **Numbers are the hero.** Weights, reps, times, PRs: large, bold, tabular figures.
3. **Calm, dark, minimal.** Low glare in a dim gym, OLED-friendly. Mostly neutral surfaces and text; one blue accent used sparingly so it *means something* (primary action, completed, trained). Remove anything that doesn't help the user log or read their training.
4. **Trustworthy offline.** The user should never wonder whether their data is saved.

**Personality:** focused and quiet: think a well-made stopwatch, not a wellness app or a gym poster. Generous spacing, few colors, few borders. No stock photos, no gradients, no illustrations. Clear type and the numbers themselves do the work.

---

## 2. Design tokens

### Color (dark only)
Define as CSS variables on `:root` and map to shadcn tokens.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0A0B` | app background (near black, OLED) |
| `--surface` | `#131316` | cards, sheets |
| `--surface-2` | `#1B1B1F` | inputs, elevated rows, active set row |
| `--surface-3` | `#25252B` | pressed states, chips |
| `--border` | `#2A2A31` | hairlines (1px) |
| `--text` | `#F4F4F5` | primary text |
| `--text-muted` | `#A1A1AA` | secondary text, labels |
| `--text-faint` | `#63636E` | placeholders, "previous" hints |
| `--accent` | `#4D9FFF` | **blue**: primary buttons, completed sets, active tab, calendar "trained" squares. Text on accent is `#0A0A0B` (≈7:1). |
| `--accent-dim` | `rgba(77,159,255,0.12)` | completed set row background, subtle highlights |
| `--pr` | `#FFB224` | gold: PR badges, trophies, PR celebration |
| `--failure` | `#FF5A4E` | "to failure" set badge, destructive actions |
| `--warmup` | `#8B8B96` | warm-up set badge |
| `--success` | `#3DDC97` | "synced" state |
| `--warning` | `#F5A524` | "offline / pending" state |

Rules: accent appears at most a few times per screen; most screens should read as greyscale plus one or two blue elements. Never put accent text on dark surfaces for body copy (only for small labels/icons). Semantic colors (`--pr`, `--failure`, `--warning`, `--success`) only where they carry meaning, never as decoration. RIR badges use neutral styling (`--text` on `--surface-3`) so they don't compete with the blue accent. All text ≥ 4.5:1 contrast.

### Typography (self-hosted via `@fontsource`, no CDN; the app must work offline)
- **Display / numbers:** **Barlow Condensed** (600/700), used only for screen titles and big numbers (timer, weights, reps in summaries, chart headline values). Condensed digits fit narrow columns.
- **UI / body:** **Inter** (400/500/600) with `font-feature-settings: "tnum"` on any numeric UI (set inputs, tables) so digits don't jitter.
- Scale (px): 12 label · 14 body-sm · 16 body · 20 title-sm · 28 title · 40 display · 64 hero-number (workout timer on finish screen).
- Section labels: Inter 500, 13px, sentence case, `--text-muted`.

### Shape, spacing, motion
- Radius: 10px inputs/rows, 16px cards, 24px bottom sheets (top corners), full-round for chips/avatars.
- Spacing: 4px grid; screen side padding 16px; card padding 16px.
- Touch targets **≥ 48×48px**; set-row inputs **≥ 52px tall**.
- Motion: fast and purposeful (150–220 ms, ease-out). Respect `prefers-reduced-motion`. Reserve the one "celebration" animation for PRs.
- Elevation: no drop shadows on dark; separate with surface steps and spacing. Use 1px borders only on inputs and list dividers, not around every card.

### Iconography
lucide-react, 20–24px, 1.75 stroke. Custom glyph-like badges for set types (see §5).

---

## 3. App shell & navigation

- **Bottom tab bar** (fixed, safe-area aware, 64px + inset): `Today` (house) · `Feed` (users) · **center Start button** · `Progress` (chart) · `Profile` (user circle).
  - Center button: round accent button, 56px, `+` icon. If a workout is active it becomes a "resume" button showing elapsed time (no pulsing).
- **Active workout mini-bar:** when a workout is active and the user is on any other screen, a slim bar sits above the tab bar: workout name · elapsed time · rest countdown if running · tap to return.
- **Top bar:** screen title (Barlow Condensed 28) left; right side: sync indicator + notifications bell (v2, with unread dot).
- **Sheets over pages:** quick actions (start workout, set options, reactions, finish summary) are **bottom sheets** (shadcn `Drawer`/vaul), not modals.
- Respect `env(safe-area-inset-*)`; standalone PWA has no browser chrome.

### Sync indicator (always visible in top bar)
| State | Visual |
|---|---|
| Synced | small `--success` dot (no text) |
| Syncing | spinning ring icon |
| Offline, N pending | `--warning` cloud-off icon + "N" pill; tap → sheet: "You're offline. N changes saved on this device and will sync automatically." |
| Error | `--failure` icon; tap → details + "Retry" |

---

## 4. Route map (TanStack Router file routes)

```
/login                       Sign in (email/username + password, Google)
/signup                      Create account
/onboarding                  Username (Google users), units, install guide, notifications (v2)
/                            Today
/workout/active              Active workout (full screen, hides tab bar)
/workout/$sessionId          Session detail (own or friend's)
/workout/$sessionId/edit     Edit a finished session
/history                     History list (also reachable from Today/Progress)
/templates                   Templates list
/templates/new, /templates/$id   Template editor
/exercises                   Exercise library
/exercises/$id               Exercise detail (charts, PRs, history)
/progress                    Progress (stats, calendar, recent PRs)
/feed                        Feed (v2)
/friends                     Friends & requests (v2)
/notifications               Notifications list (v2)
/profile                     Profile & settings hub
/settings/units, /settings/workout, /settings/notifications, /settings/sync, /settings/install
```

---

## 5. Screens

For each: purpose → layout → key components → states. Use realistic sample data in mocks (see §8).

### 5.1 Login / Signup
- Full-bleed `--bg`, app wordmark **"STRYDE"** in Barlow Condensed (large, uppercase, tight tracking). No decorative marks.
- Fields: "Email or username", "Password". Primary button "Sign in". Divider "or". Secondary button "Continue with Google" (white G logo on `--surface-2`). Link to switch sign in ↔ sign up.
- Signup: display name, username (live availability check, inline ✓/✗), email, password.
- Note under form (muted, small): "Forgot password? Sign in with Google or contact the admin." (no email reset in v1).
- Offline state: banner "You're offline, so signing in needs a connection."

### 5.2 Onboarding (3–4 short steps, progress dots)
1. Pick username (Google users only).
2. Units: two big toggle cards, **KG** (default selected) / **LB**.
3. Install the app: platform-specific mini-guide. iOS: "Tap Share → Add to Home Screen" with simple icon diagrams; Android: "Install" button.
4. (v2) Notifications: explain what you'll get (friend finishes workout, reactions, rest timer), "Enable notifications" button (permission request happens on this tap), "Not now".

### 5.3 Today (home)
Top to bottom:
- Greeting line (muted) + date.
- **Week strip:** 7 day circles Mon–Sun; trained days filled accent with a check, today outlined. Caption: "3 workouts this week".
- **Start card:** big primary "Start empty workout" + horizontal scroll of **template chips/cards** (name, exercise count, "last done 4d ago"). Tap template → start sheet with preview + "Start".
- If active workout exists → this card becomes **"Resume Push Day · 32:14"**.
- **Recent workouts** (last 3): compact cards (name, date, duration, sets, PR badge) → session detail. "See all" → History.
- Empty state (new user): friendly line "No workouts yet. Your first one sets the baseline." + start button.

### 5.4 Active workout (**the most important screen; design this with the most care**)
Full screen, tab bar hidden, mini-bar not shown.

**Header (sticky):** back-chevron (minimizes, doesn't end) · editable workout name · **elapsed timer** (Barlow Condensed, tabular) · **Finish** button (accent, small). Below the header, a thin progress line showing completed sets / total.

**Body:** vertical list of **exercise cards**:
```
┌──────────────────────────────────────────────┐
│ A1  Bench Press                    ⋯  (menu) │  ← superset label pill (if in superset)
│     Barbell · Chest      Rest 2:00            │
├──────────────────────────────────────────────┤
│ SET  PREVIOUS      KG      REPS   RIR   ✓    │  ← column labels (12px, muted, caps)
│  W   40×10         [40]    [10]    –   [✓]   │  ← warm-up row (grey W badge)
│  1   80×8 @1       [80]    [  ]   [1]  [ ]   │  ← RIR set: reps empty, placeholder "8"
│  2   80×7 F        [80]    [  ]    F   [ ]   │  ← failure set: red F badge, RIR fixed 0
│ + Add set                                     │
└──────────────────────────────────────────────┘
```
- **Set number cell** = badge that also shows type: `W` (grey) warm-up, number for working sets; the **target** shown as a tiny tag under/next to it: `8–12`, `@2` (RIR, neutral), `F` (failure, red). Tap → set options sheet: set type, target kind, target reps/range/RIR, delete set.
- **Previous** column: `--text-faint`, e.g. `80×8 @1` or `80×7 F`. Tapping it copies values into the row.
- **Inputs:** large (52px), centered, tabular. `inputmode="decimal"` for weight, `"numeric"` for reps/RIR. On focus, select-all. For RIR/failure sets, reps is **empty with the previous value as placeholder**, and the ✓ is disabled (outlined) until reps is entered. Fixed sets come pre-filled.
- **Complete ✓:** 48px square. Tapping: row background → `--accent-dim`, ✓ fills accent, subtle haptic (Android), row inputs remain editable. Then **rest timer starts**.
- **PR in-line hint:** if a just-completed set is a PR, show a small gold 🏆 chip on the row ("e1RM PR").
- Swipe row left → delete. Long-press card header (or ⋯ menu) → reorder, add to superset, change rest, remove exercise, replace exercise.
- **Supersets:** cards in the same group are visually joined: a 2px `--surface-3` vertical rail on the left connecting them, labels `A1`, `A2`; one shared rest timer after the last exercise of the round.
- **Timed exercise rows:** columns `KG (optional)` and `TIME` (mm:ss input).
- **Bodyweight rows:** column header `+KG` (added weight, optional) instead of `KG`.

**Bottom area (thumb zone):**
- "+ Add exercise" full-width secondary button → exercise picker sheet (search, recent, muscle filter chips, "create custom").
- Workout notes field (collapsed "Add note").
- "Discard workout" (destructive text button, confirmation dialog).

**Rest timer bar** (overlays bottom when running): big countdown `1:42` (Barlow 40), thin progress bar, `−15` · `+15` · `Skip`. At 0: bar turns accent, vibrates, then auto-dismisses after 3 s. Next set to do is subtly highlighted.

**Unit display:** column header and placeholders follow the user's unit (KG/LB).

### 5.5 Finish workout (bottom sheet, full height)
- Hero: **duration** in hero size (`1:12:48`), workout name, date.
- Stat row (3 tiles): Sets · Volume (kg) · Exercises.
- **PRs section** (if any): gold cards: "🏆 Bench Press · e1RM 101.3 kg (+2.5)". This is the one place for a **celebration**: a brief, subtle gold shimmer across the PR cards, once, reduced-motion aware. No confetti.
- Incomplete sets warning (if any): "3 sets not completed will be discarded" with "Go back".
- Notes textarea.
- **"Share with friends"** switch with helper text: "Friends will be notified and can see this workout." (v2; in v1 still show the toggle since it's stored.)
- Primary: "Save workout".

### 5.6 Session detail
Header: name, date, time range, duration, share status icon (eye / eye-off). Stats tiles. List of exercises with completed sets as compact rows (`80 kg × 8 @1`, `F` badges, 🏆 marks). Notes. Owner actions: Edit, Share toggle, Delete. Friend view (v2): owner avatar + name at top, reactions bar at bottom, no edit actions.

### 5.7 History
Reverse-chronological list grouped by month (sticky month headers). Each item: date block (day number big + weekday), workout name, duration, sets, PR badge count.

### 5.8 Templates list & editor
- List: cards with name, exercises preview ("Bench, Incline DB, Dips +3"), "Start" button on each card.
- Editor: name field; exercise cards similar to active workout but inputs are **targets**: set type, target kind segmented control (`Reps` / `RIR` / `Failure`), target reps or range (e.g. `8–12`), target RIR, planned weight (optional), rest time per exercise. Drag handles to reorder; "Group as superset" via multi-select.

### 5.9 Exercise library & detail
- Library: search field (sticky), muscle group chips (horizontal scroll), list rows: name, equipment · muscle, small "custom" tag for user exercises. FAB/top "+" → create custom (name, type segmented: Weighted / Bodyweight / Timed, muscle, equipment, default rest).
- **Detail:**
  - Header: name, muscle · equipment.
  - **Headline metric**: current e1RM (big Barlow number) + delta vs 3 months ago (`--text` ▲ / muted ▼).
  - **Chart card:** metric switcher (segmented: `e1RM` · `Best set` · `Volume` for weighted; `Max reps` · `Total reps` for bodyweight; `Duration` for timed) + range chips `1M 3M 6M 1Y All`. Line chart: accent line, 2px, dots on data points, PR points rendered as **gold dots**. Minimal gridlines (`--border`), muted axis labels, tooltip card showing date + best set.
  - **Personal records** list: rows with PR type, value, date (gold trophy icon).
  - **History**: per-session set lists.

### 5.10 Progress tab
- Stat tiles (2×2): This week · This month · This year · Total workouts.
- **Calendar card** with toggle `Year` / `Month`:
  - **Year:** GitHub-style grid, 53 columns × 7 rows of ~11px squares with 3px gap, horizontally scrollable, auto-scrolled to current week. **Binary**: trained = solid accent square, not trained = `--surface-3`. No intensity levels. Month labels above, M/W/F labels left. Tap square → tooltip/sheet with that day's workouts.
  - **Month:** standard calendar grid; trained days show an accent filled circle with a dark check; today outlined; tap day → list of that day's sessions in a sheet. Prev/next month arrows.
- **Recent PRs** list (gold), "See all".
- Lifetime volume, total sets.

### 5.11 Feed (v2)
- Cards, newest first, infinite scroll, pull-to-refresh:
```
[avatar] Marco Reyes                    2h ago
         FINISHED  LEG DAY                         (Barlow, uppercase)
         ⏱ 1h 12m   ·   6 exercises   ·   22 sets
         🏆 2 PRs  (gold chip, tap shows which)
  ─────────────────────────────────────────────
  💪 3   🔥 1   [+ react]
```
- Own workouts appear too, labeled "You".
- Tap card → session detail (friend view). Tap react → small horizontal emoji picker popover: 💪 🔥 👏 🏆 😤; selected one highlighted with accent ring. Tap counts → sheet listing who reacted.
- Empty state: "Add friends to see their workouts here" + "Find friends" button.
- Offline: the feed is **not** cached. Show a simple offline state (cloud-off icon + "You're offline. The feed will load when you're back online."). No retry button needed; it reloads automatically when the connection returns.

### 5.12 Friends (v2)
Tabs: `Friends` · `Requests (n)`. Search bar "Add by username" with result row + "Add" button. Friend row: avatar, name, @username, last workout ("trained yesterday"), ⋯ menu (Mute notifications / Remove friend). Request rows with Accept (accent) / Decline.

### 5.13 Notifications (v2)
List of items (icon by type, text, time ago, unread dot). Tap → relevant screen. "Mark all read".

### 5.14 Profile & settings
Profile header: avatar (tap to change), display name, @username, small stats line (workouts, member since). Settings list (grouped rows with chevrons, iOS-settings style but dark):
- **Workout:** Units (KG/LB), Default rest time, Keep screen on during workouts, Share new workouts with friends by default.
- **Notifications (v2):** Mute all (master switch at top, dims others when on), Friend workouts, Reactions, Friend requests, Rest timer, Muted friends →.
- **Sync & data:** status, last synced time, pending changes, "Sync now".
- **App:** Install app guide, version (git SHA).
- **Account:** Sign out (warning dialog if unsynced changes).

---

## 6. Components

### 6.1 shadcn/ui foundation
All primitives come from **shadcn/ui** (installed with the shadcn CLI into `src/components/ui/`) and are themed through shadcn's CSS variables mapped to the tokens in §2. Custom app components (§6.2) are compositions of these.

| shadcn component | Used for |
|---|---|
| `Button` | all buttons; variants: `default` = accent primary, `secondary` = `--surface-2`, `ghost`, `destructive` = `--failure`, `outline` |
| `Input`, `Textarea`, `Label` | forms; `NumberInput` wraps `Input` |
| `Drawer` (vaul) | **all bottom sheets**: start workout, set options, exercise picker, finish workout, day details, who reacted |
| `Dialog`, `AlertDialog` | confirmations (discard workout, delete, sign out with pending changes), active-session conflict |
| `Tabs` | Year/Month calendar toggle, Friends/Requests |
| `ToggleGroup` | target kind (Reps / RIR / Failure), exercise type, chart metric, range chips, units |
| `Switch` | settings, "Share with friends" |
| `Select` | muscle group, equipment |
| `DropdownMenu` | exercise card ⋯ menu, template menu, friend row menu |
| `Popover` | reaction picker, sync indicator details (desktop) |
| `Badge` | set-type badges, PR chips, "custom" tag, pending count |
| `Card` | stat tiles, feed cards, template cards |
| `Avatar` | user avatars with initials fallback |
| `Skeleton` | loading states |
| `Sonner` (toast) | undo delete, "Update available", errors |
| `Chart` (Recharts wrapper) | exercise progress charts |
| `Progress` | rest timer bar, workout progress line |
| `Separator`, `ScrollArea` | lists, horizontal chip rows |
| `Calendar` (optional) | month view base if it fits the binary style; otherwise custom grid |

Theming rules: override shadcn variables once in the global CSS (`--background: var(--bg)`, `--card: var(--surface)`, `--primary: var(--accent)`, `--primary-foreground: #0A0A0B`, `--destructive: var(--failure)`, `--border`, `--input`, `--ring: var(--accent)`, `--radius: 10px`). No light theme block. Adjust component sizes for the 48px touch-target rule (e.g. `Button` default height 48px, large inputs 52px).

### 6.2 App components (build once, reuse everywhere)
- `SetRow` (modes: active / edit / readOnly / template), `ExerciseCard`, `SupersetGroup`
- `SetBadge` (W / number + target tag `8–12`, `@2`, `F`)
- `NumberInput` (large, tabular, select-on-focus, unit suffix)
- `RestTimerBar`, `WorkoutTimer`, `ActiveWorkoutMiniBar`
- `StatTile`, `PRBadge` / `PRCard`, `SyncIndicator`
- `YearGrid`, `MonthCalendar`, `WeekStrip`
- `ExerciseChart` (Recharts wrapper using tokens)
- `FeedCard`, `ReactionBar`, `ReactionPicker`, `Avatar` (image or initials on `--surface-3`)
- `EmptyState` (icon + one line + optional action), `BottomSheet`, `ConfirmDialog`

## 7. States every screen must handle
- **Loading:** skeletons shaped like the content (`--surface-2` blocks, subtle shimmer). Local-data screens should almost never show loading.
- **Empty:** one short, encouraging line + action. No illustrations.
- **Offline:** never block own-data (workout) screens; show the sync indicator state. Social screens (Feed, Friends, Notifications, a friend's session detail) are online-only: show an offline state in place of content, and disable reaction/friend buttons. Network-only actions show inline "Needs a connection".
- **Error:** inline message + retry; never lose typed input.

## 8. Sample data for mocks
User: "Juan Dela Cruz" (@juandc), units kg. Friends: Marco Reyes, Bea Santos, Paolo Lim.
Templates: Push Day (Bench Press, Incline DB Press, Overhead Press, Dips, Lateral Raise, Triceps Pushdown), Pull Day (Pull-up, Barbell Row, Lat Pulldown, Face Pull, Hammer Curl), Leg Day (Squat, Romanian Deadlift, Leg Press, Leg Curl, Calf Raise).
Example sets: Bench 40×10 (W), 80×8 @1, 80×7 F, 77.5×7 F. Pull-up +10 kg ×6 F. Plank 1:30.

## 9. Accessibility
Contrast ≥ 4.5:1 for text; touch targets ≥ 48px; every icon-only button has `aria-label`; set rows are labeled ("Set 2, 80 kilograms, reps, to failure"); color is never the only signal (badges also carry letters/icons); supports dynamic text up to 130% without breaking set rows.

## 10. Don'ts
- No light mode, no theme toggle.
- No gradients, glassmorphism, or drop shadows as decoration.
- No decorative accent marks (bars, underlines, glows) or pulsing elements.
- No stock photos, mascots, or illustrations.
- Don't use the accent for more than primary action + completed + trained + active tab.
- Don't hide the Finish button or rest-timer controls behind menus.
- Don't use tiny native number spinners; use the large `NumberInput`.
