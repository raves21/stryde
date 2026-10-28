import type { ExerciseType, PrType } from '../constants'
import { type CalcSet, countedSets, e1rm, sessionVolume } from './sets'

export type DetectedPR = {
  prType: PrType
  /** e1RM/weight/volume in kg, reps for reps_at_weight/max_reps, seconds for duration. */
  value: number
  /** The best value before this session. */
  previous: number
  /** The set that achieved it (null for session volume). */
  setId: string | null
  /** For reps_at_weight: the weight the reps were done at. */
  weightKg?: number
}

const max = (values: number[]) => values.reduce((m, v) => Math.max(m, v), Number.NEGATIVE_INFINITY)

/** The counted set with the highest value of `f` (first wins ties), with that value. */
function top(
  sets: CalcSet[],
  f: (s: CalcSet) => number | null,
): { set: CalcSet; value: number } | null {
  let best: { set: CalcSet; value: number } | null = null
  for (const set of sets) {
    const value = f(set)
    if (value !== null && (!best || value > best.value)) best = { set, value }
  }
  return best
}

const addedWeight = (s: CalcSet) => (s.weightKg !== null && s.weightKg > 0 ? s.weightKg : null)

/**
 * PRs of one exercise in `session` against all earlier sessions of that exercise
 * (PRODUCT_SPEC.md §6). The first session with counted sets is the baseline: no PRs.
 */
export function detectPRs(
  exerciseType: ExerciseType,
  history: CalcSet[][],
  session: CalcSet[],
): DetectedPR[] {
  const past = history.map(countedSets).filter((s) => s.length > 0)
  const now = countedSets(session)
  if (past.length === 0 || now.length === 0) return []
  const before = past.flat()
  const prs: DetectedPR[] = []

  const higher = (prType: PrType, f: (s: CalcSet) => number | null) => {
    const best = top(now, f)
    if (!best) return
    const previous = max(before.map(f).filter((v): v is number => v !== null))
    if (best.value > previous) {
      prs.push({ prType, value: best.value, previous: Math.max(previous, 0), setId: best.set.id })
    }
  }

  if (exerciseType === 'timed') {
    higher('duration', (s) => s.durationSec)
    return prs
  }

  const loaded = (f: (s: CalcSet) => number | null) => (s: CalcSet) =>
    addedWeight(s) === null ? null : f(s)
  higher('e1rm', e1rm)
  higher(
    'weight',
    loaded((s) => (s.reps !== null && s.reps >= 1 ? s.weightKg : null)),
  )

  if (exerciseType === 'weighted') {
    // Most reps at a weight (or heavier) than ever before, at a weight already lifted
    // (a heavier-than-ever set is a weight PR instead).
    let best: DetectedPR | null = null
    for (const s of now) {
      if (s.reps === null || s.weightKg === null) continue
      const w = s.weightKg
      const atOrAbove = before.filter((p) => (p.weightKg ?? 0) >= w && p.reps !== null)
      if (atOrAbove.length === 0) continue
      const previous = max(atOrAbove.map((p) => p.reps ?? 0))
      if (s.reps > previous && (!best || w > (best.weightKg ?? 0))) {
        best = { prType: 'reps_at_weight', value: s.reps, previous, setId: s.id, weightKg: w }
      }
    }
    if (best) prs.push(best)

    const volume = sessionVolume(now)
    const previousVolume = max(past.map(sessionVolume))
    if (volume > previousVolume) {
      prs.push({ prType: 'volume', value: volume, previous: previousVolume, setId: null })
    }
  }

  if (exerciseType === 'bodyweight') {
    higher('max_reps', (s) => (addedWeight(s) === null ? s.reps : null))
  }
  return prs
}
