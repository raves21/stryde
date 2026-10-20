# Phase 3 — Exercises & Templates

> Release: **v1** · Depends on: Phase 2 · Next: `phase-04-active-workout.md`
> References: `PRODUCT_SPEC.md` §4.1–4.2, `UI_DESIGN.md` §3 (app shell), §5.8–5.9.

## Goal
The app shell with bottom navigation exists; users can browse/create exercises and build templates (including supersets), fully offline.

## Tasks

### 1. App shell (`UI_DESIGN.md` §3)
- Root layout: top bar (title + `SyncIndicator`), bottom tab bar (Today · Feed · center Start · Progress · Profile), safe-area padding.
- Feed tab in v1: placeholder screen "Friends & feed are coming soon" (real feed in Phase 8).
- Shared building blocks built **on shadcn/ui**: `BottomSheet` (shadcn `Drawer`), `ConfirmDialog` (shadcn `AlertDialog`), `EmptyState`, `NumberInput` (wraps shadcn `Input`, large tabular style), toasts via shadcn `Sonner`.

### 2. Exercise library (`/exercises`, `/exercises/$id` stub)
- List from Dexie: presets + own custom (non-deleted), sorted by name.
- Sticky search (shadcn `Input`), muscle-group filter chips (shadcn `ToggleGroup` or `Badge` buttons, horizontal scroll).
- "custom" tag on user exercises.
- Create / edit custom exercise in a `Drawer` form: name, type (shadcn `ToggleGroup`: Weighted / Bodyweight / Timed), muscle group + equipment (shadcn `Select`), default rest.
- Archive (soft delete) custom exercise with confirm; history is kept.
- Reusable **`ExercisePicker`** sheet (search, recent, muscle chips, "create custom") — used by template editor and active workout.
- Detail route is a stub here; full charts come in Phase 5.

### 3. Templates (`/templates`, `/templates/new`, `/templates/$id`)
- List: cards with name, exercise preview, "Start" button (wire up in Phase 4), overflow menu (shadcn `DropdownMenu`): Duplicate, Delete.
- Editor:
  - Name input, notes.
  - Exercise cards with ordered planned sets. Per set: set type (warmup/working), target kind (shadcn `ToggleGroup`: Reps / RIR / Failure), target reps or range (`8–12`), target RIR, planned weight (optional), and per-exercise rest time.
  - Add/remove sets and exercises; reorder exercises with drag handles (use `@dnd-kit/sortable`), with up/down buttons as an accessible fallback.
  - Superset: multi-select exercises → "Group as superset" assigns the next free letter to `supersetGroup`; "Ungroup".
  - Autosave through repositories (debounced), no explicit Save button needed; show "Saved" state.
- Pure function in `packages/shared` (or `apps/web/src/features/templates/`): `templateToSession(template, now, timezone)` → session + session_exercises + sets rows (used in Phase 4).

## Tests
- `templateToSession` copies order, supersets, targets, planned weights; generates new IDs; computes `localDate` from timezone.
- Repository tests for duplicate template (deep copy with new IDs).

## Acceptance criteria
- [ ] Bottom nav works; Feed shows placeholder.
- [ ] Create a custom exercise and a "Push Day" template with a superset, fully offline; it syncs after reconnect and appears on a second device.
- [ ] All checks green.
