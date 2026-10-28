import {
  type ExerciseRow,
  type ExerciseType,
  type SessionExerciseRow,
  type SetRow,
  type SetType,
  type TargetKind,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'

// Pure workout rules and formatting (PRODUCT_SPEC.md §4.3), kept apart from React and
// Dexie so repositories and components share them and tests stay simple.

/** 90 → "1:30". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type Typed = { setType: SetType }

/**
 * The previous set for each set position: the n-th warm-up matches the n-th previous
 * warm-up, the n-th working set the n-th previous working set.
 */
export function matchPrevious<T extends Typed, P extends Typed>(
  sets: T[],
  previous: P[],
): (P | undefined)[] {
  const byType = {
    warmup: previous.filter((p) => p.setType === 'warmup'),
    working: previous.filter((p) => p.setType === 'working'),
  }
  const seen = { warmup: 0, working: 0 }
  return sets.map((s) => {
    const match = byType[s.setType][seen[s.setType]]
    seen[s.setType] += 1
    return match
  })
}

type Actuals = Pick<SetRow, 'weightKg' | 'reps' | 'rir' | 'durationSec'>
type Targets = Pick<SetRow, 'targetKind' | 'targetReps' | 'targetRir'>

/**
 * Pre-fill rules: weight from the previous set, else the planned weight. Fixed sets get
 * reps = target (else previous reps). RIR/failure sets leave reps empty (the user must
 * enter them); RIR defaults to the target, failure is RIR 0. Timed sets take the
 * planned duration, else the previous one.
 */
export function prefill(
  set: Targets,
  previous: Actuals | undefined,
  planned: { weightKg: number | null; durationSec: number | null } = {
    weightKg: null,
    durationSec: null,
  },
): Actuals {
  const weightKg = previous?.weightKg ?? planned.weightKg
  const durationSec = planned.durationSec ?? previous?.durationSec ?? null
  switch (set.targetKind) {
    case 'fixed':
      return { weightKg, reps: set.targetReps ?? previous?.reps ?? null, rir: null, durationSec }
    case 'rir':
      return { weightKg, reps: null, rir: set.targetRir, durationSec }
    case 'failure':
      return { weightKg, reps: null, rir: 0, durationSec }
  }
}

/** Actual fields a target kind implies when it changes on a set. */
export function targetKindPatch(
  set: Pick<SetRow, 'targetRir' | 'rir'>,
  kind: TargetKind,
): Pick<SetRow, 'targetKind' | 'targetRir' | 'rir'> {
  if (kind === 'rir') {
    const targetRir = set.targetRir ?? 2
    return { targetKind: kind, targetRir, rir: set.rir ?? targetRir }
  }
  return { targetKind: kind, targetRir: null, rir: kind === 'failure' ? 0 : null }
}

/**
 * Rest after completing `set`, in seconds, or null for none: warm-ups don't start rest,
 * and in a superset only the last exercise of the round does. Duration: the session
 * exercise's rest → the exercise's default → the user's default.
 */
export function restAfter({
  set,
  sessionExercise,
  sessionExercises,
  exercise,
  defaultRestSeconds,
}: {
  set: Pick<SetRow, 'setType'>
  sessionExercise: SessionExerciseRow
  sessionExercises: SessionExerciseRow[]
  exercise: Pick<ExerciseRow, 'defaultRestSeconds'> | undefined
  defaultRestSeconds: number
}): number | null {
  if (set.setType === 'warmup') return null
  const group = sessionExercise.supersetGroup
  if (group) {
    const members = sessionExercises
      .filter((se) => se.supersetGroup === group && !se.deletedAt)
      .sort((a, b) => a.position - b.position)
    if (members.at(-1)?.id !== sessionExercise.id) return null
  }
  return sessionExercise.restSeconds ?? exercise?.defaultRestSeconds ?? defaultRestSeconds
}

/** "80×8 @1", "80×7 F", "+10×6", "×12", "1:30", "20 kg · 1:30" (UI_DESIGN.md §5.4). */
export function formatPrevious(
  set: Pick<SetRow, 'weightKg' | 'reps' | 'rir' | 'durationSec' | 'targetKind'>,
  type: ExerciseType,
  unit: WeightUnit,
): string {
  const w = set.weightKg === null ? null : toDisplayWeight(set.weightKg, unit)
  if (type === 'timed') {
    const time = set.durationSec === null ? '' : formatDuration(set.durationSec)
    return w ? `${w} ${unit}${time ? ` · ${time}` : ''}` : time
  }
  const weight = type === 'bodyweight' ? (w ? `+${w}` : '') : (w ?? '')
  const reps = set.reps === null ? '' : `×${set.reps}`
  const tag =
    set.targetKind === 'failure'
      ? ' F'
      : set.targetKind === 'rir' && set.rir !== null
        ? ` @${set.rir}`
        : ''
  return `${weight}${reps}${tag}`
}

/** Seconds → "m:ss"; parses "1:30", "90", "1:5". */
export function parseDuration(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  const m = /^(?:(\d{1,3}):)?(\d{1,5})$/.exec(t)
  if (!m) return undefined
  const minutes = m[1] === undefined ? 0 : Number(m[1])
  const seconds = Number(m[2])
  if (m[1] !== undefined && seconds >= 60) return undefined
  return minutes * 60 + seconds
}

/** Elapsed ms → "32:14" or "1:12:48". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Session-detail line: "80 kg × 8 @1", "+10 kg × 6", "× 12", "1:30", "20 kg · 1:30". */
export function formatSetLine(
  set: Pick<SetRow, 'weightKg' | 'reps' | 'rir' | 'durationSec' | 'targetKind'>,
  type: ExerciseType,
  unit: WeightUnit,
): string {
  const w =
    set.weightKg === null || set.weightKg === 0
      ? null
      : `${toDisplayWeight(set.weightKg, unit)} ${unit}`
  if (type === 'timed') {
    const time = set.durationSec === null ? '' : formatDuration(set.durationSec)
    return [w, time].filter(Boolean).join(' · ')
  }
  const weight = w ? (type === 'bodyweight' ? `+${w}` : w) : ''
  const reps = set.reps === null ? '' : `× ${set.reps}`
  const rir = set.targetKind === 'rir' && set.rir !== null ? ` @${set.rir}` : ''
  return `${[weight, reps].filter(Boolean).join(' ')}${rir}`
}
