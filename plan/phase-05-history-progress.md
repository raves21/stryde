# Phase 5 — History, Calendar, Progress & PRs

> Release: **v1** · Depends on: Phase 4 · Next: `phase-06-pwa-offline.md`
> References: `PRODUCT_SPEC.md` §4.4–4.5 and **§6 (calculations)**, `UI_DESIGN.md` §5.6–5.7, §5.9–5.10.

## Goal
Users see their history, a binary trained/not-trained calendar, per-exercise progress charts, and PRs, all computed from local data and working offline.

## Tasks

### 1. Calculation module (`packages/shared/src/calc/`) — write tests first
- `effectiveReps(set)`, `e1rm(set)` (Epley, RIR-adjusted, null when effective reps > 15, exact weight for 1 rep @ 0 RIR).
- `bestSet(sets)`, `sessionVolume(sets)`, `maxReps`, `totalReps`, `longestDuration`.
- `detectPRs(history, session)` → list of `{ exerciseId, prType, value, previous, setId }` for types `e1rm`, `weight`, `reps_at_weight`, `volume`, `max_reps`, `duration` (per exercise type).
  - **Baseline rule:** the first session that contains an exercise produces no PRs.
  - Only completed working sets count; warm-ups ignored everywhere.
- `computeAllPRs(sessionsChronological)` used to rebuild PRs after edits/deletes.
- `seriesForChart(sessions, exerciseId, metric, range)` → `{ date, value, isPR }[]` (one point per session).
- Table-driven tests covering: failure sets, RIR sets, bodyweight with/without added weight, timed, warm-up exclusion, baseline rule, edited history lowering a PR, reps > 15.

### 2. Server PR recompute
- Fill the `onSessionsChanged` hook from Phase 2: recompute `personal_records` for each touched exercise of that user using `computeAllPRs` (same shared module). Store the PR summary for each finished session (used by the feed in Phase 8).

### 3. History (`/history`) & session detail (`/workout/$sessionId`)
- History: grouped by month with sticky headers; item shows date block, name, duration, sets, PR count.
- Session detail (own): stats tiles, exercises with completed sets (`80 kg × 8 @1`, `F` badges, 🏆 marks), notes, actions (Edit, Share toggle, Delete).
- PR marks computed client-side with `packages/shared/calc`.

### 4. Calendar
- `YearGrid`: 53 × 7, binary (trained = volt, else `--surface-3`), month labels, auto-scroll to current week, tap → day's sessions in a `Drawer`.
- `MonthCalendar`: trained days = volt circle with check, today outlined, prev/next month, tap → day sheet.
- `WeekStrip` for the Today screen.
- All based on `session.localDate` of finished, non-deleted sessions.

### 5. Exercise detail (`/exercises/$id`)
- Headline metric with delta vs. 3 months ago.
- `ExerciseChart` built with **shadcn `Chart`** (Recharts) using token colors: volt line, gold dots on PR points, minimal grid, custom tooltip.
- Metric switcher per exercise type (shadcn `ToggleGroup`), range chips 1M / 3M / 6M / 1Y / All.
- Personal records list and per-session history.

### 6. Progress tab (`/progress`)
- Stat tiles: this week / month / year / total workouts.
- Calendar card with Year/Month toggle (shadcn `Tabs`).
- Recent PRs (gold), lifetime volume, total sets.

### 7. Today screen polish
- Week strip, recent workouts (last 3), empty state.

## Acceptance criteria
- [ ] Calc tests pass and cover every case listed above.
- [ ] Charts and calendar render offline from local data.
- [ ] PR badge appears on the finish sheet, in session detail, and on the chart.
- [ ] Editing an old session updates PRs locally and on the server.
- [ ] All checks green.
