# Phase 4 — Active Workout Logging

> Release: **v1** · Depends on: Phase 3 · Next: `phase-05-history-progress.md`
> **Core UX of the whole app.** Follow `UI_DESIGN.md` §5.3–5.5 closely. Behavior: `PRODUCT_SPEC.md` §4.3.

## Goal
A user can start, log, and finish a workout entirely offline, quickly, and never lose data.

## Tasks

### 1. Starting a workout
- From the Today screen (basic version: Start empty + template chips + Resume card) and from the center tab button.
- Start from template → `templateToSession` → write via repositories. Start empty → session named "Workout".
- Enforce **one active session**: if one exists, the Start button becomes Resume.
- `shareWithFriends` initialised from `user_settings.defaultShareWithFriends`; `timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### 2. Active workout screen (`/workout/active`)
- Full-screen layout (no tab bar). Sticky header: minimize chevron, editable name, elapsed timer, Finish button; progress line (completed/total sets).
- `ExerciseCard` + `SetRow` components (`UI_DESIGN.md` §5.4 and §6), built from shadcn primitives.
- **"Previous" values**: for each exercise, find the most recent *finished* session containing it; match by working-set index (warm-ups matched separately). Display as `80×8 @1` / `80×7 F`; tap copies into the row.
- **Pre-fill rules** (`PRODUCT_SPEC.md` §4.3):
  - `fixed`: weight from previous → template planned weight; reps = target.
  - `rir` / `failure`: weight pre-filled; reps **empty**, previous reps as placeholder; RIR defaults to target (rir) or locked to 0 (failure).
- Completion ✓ disabled until required actuals exist (validated with the shared Zod rule). Completing sets `completedAt = now`; un-ticking clears it.
- Set options sheet (tap the set badge): set type, target kind, target reps/range/RIR, delete.
- Exercise menu (`DropdownMenu`): reorder, replace exercise, add to / remove from superset, change rest, remove exercise.
- Swipe left on set row to delete (with undo toast via Sonner).
- Exercise-type specific columns: bodyweight → `+KG`; timed → `KG (optional)` + `TIME` (mm:ss input).
- Weight input/display in the user's unit; stored in kg (`packages/shared/units.ts`).
- Every edit writes through repositories immediately (no in-memory-only state) so a killed app resumes exactly.

### 3. Timers
- Elapsed time = `now - startedAt`, re-rendered every second with `requestAnimationFrame`/interval but **computed** from timestamps.
- **Rest timer**: on completing a working set, set `meta.restTimer = { endsAt, sessionId, setId }` (rest = session_exercise.restSeconds → exercise.defaultRestSeconds → settings default). For supersets, start rest only after the last exercise in the round.
- `RestTimerBar`: countdown, progress, −15 / +15 / Skip. At zero: flash, `navigator.vibrate` (where supported), optional short sound, auto-dismiss after 3 s. Survives reload because it's stored as `endsAt`.
- Background notification for rest is **Phase 9**; leave a hook `onRestTimerChanged(endsAt | null)`.

### 4. Minimized state
- `ActiveWorkoutMiniBar` above the tab bar on all other screens (name, elapsed, rest countdown). Center tab button shows "resume" state.

### 5. Finish & discard
- Finish sheet (`UI_DESIGN.md` §5.5): duration hero, stat tiles (sets, volume, exercises), incomplete-sets warning, notes, "Share with friends" switch (stored even though social is v2), Save.
- On Save: delete incomplete sets (soft), set `finishedAt`, trigger immediate `syncNow()`.
- PRs on the finish sheet use `packages/shared/calc` — implement a minimal version now if Phase 5's calc module isn't ready, but **the final logic lives only in `packages/shared/calc`** (no duplicates).
- Discard: `AlertDialog` → soft-delete session and children.

### 6. Editing a finished session (`/workout/$sessionId/edit`)
- Reuse the same components in "edit" mode (no timers, start/finish times editable, share toggle).

### 7. Screen Wake Lock
- Request `navigator.wakeLock` while the active workout screen is visible (setting "Keep screen on", default on); re-acquire on `visibilitychange`; release on finish/minimize.

## Tests
- Unit: previous-value matching; pre-fill rules per target kind; rest duration resolution incl. supersets.
- Component: `SetRow` disables ✓ for empty reps on rir/failure sets.
- **Playwright e2e:** start from template → log sets incl. a failure set (must type reps) → finish → session appears in DB/history; repeat with `context.setOffline(true)` and verify it syncs after going online.

## Acceptance criteria
- [ ] Full workout loggable in airplane mode.
- [ ] Killing/reloading the app mid-workout resumes exactly (sets, timers, rest timer).
- [ ] Logging one failure set takes ≤ 2 taps + typing the reps.
- [ ] All checks green.
