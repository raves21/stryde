import type { SetRow } from '../schemas/rows'

// Calculations (PRODUCT_SPEC.md §6). The only place this math lives; web and api both
// import it. Working, completed, non-deleted sets only; warm-ups never count.

/** The fields the calculations read. */
export type CalcSet = Pick<
  SetRow,
  'id' | 'setType' | 'weightKg' | 'reps' | 'rir' | 'durationSec' | 'completedAt' | 'deletedAt'
>

/** Completed, non-deleted working sets. */
export function countedSets<T extends CalcSet>(sets: T[]): T[] {
  return sets.filter((s) => s.setType === 'working' && s.completedAt !== null && !s.deletedAt)
}

/** reps + rir (failure sets have rir 0); null without reps. */
export function effectiveReps(set: Pick<CalcSet, 'reps' | 'rir'>): number | null {
  return set.reps === null ? null : set.reps + (set.rir ?? 0)
}

/**
 * Epley e1RM, RIR-adjusted: weight × (1 + effectiveReps / 30); exactly the weight for a
 * single rep at RIR 0; null above 15 effective reps (inaccurate) or without a weight > 0.
 * For bodyweight exercises the weight is the added weight.
 */
export function e1rm(set: Pick<CalcSet, 'weightKg' | 'reps' | 'rir'>): number | null {
  const reps = effectiveReps(set)
  if (reps === null || reps < 1 || set.weightKg === null || set.weightKg <= 0) return null
  if (reps > 15) return null
  if (set.reps === 1 && (set.rir ?? 0) === 0) return set.weightKg
  return set.weightKg * (1 + reps / 30)
}

/** Σ weight × reps over counted sets. */
export function sessionVolume(sets: CalcSet[]): number {
  return countedSets(sets).reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0)
}

/** Highest e1RM; fallback highest weight, then reps. Null without counted sets. */
export function bestSet<T extends CalcSet>(sets: T[]): T | null {
  let best: T | null = null
  for (const s of countedSets(sets)) {
    if (!best) {
      best = s
      continue
    }
    const a = e1rm(s) ?? -1
    const b = e1rm(best) ?? -1
    if (
      a > b ||
      (a === b && (s.weightKg ?? 0) > (best.weightKg ?? 0)) ||
      (a === b && (s.weightKg ?? 0) === (best.weightKg ?? 0) && (s.reps ?? 0) > (best.reps ?? 0))
    ) {
      best = s
    }
  }
  return best
}

/** Most reps in one counted set (null without reps). */
export function maxReps(sets: CalcSet[]): number | null {
  const reps = countedSets(sets).flatMap((s) => (s.reps === null ? [] : [s.reps]))
  return reps.length ? Math.max(...reps) : null
}

/** Σ reps over counted sets (null without reps). */
export function totalReps(sets: CalcSet[]): number | null {
  const reps = countedSets(sets).flatMap((s) => (s.reps === null ? [] : [s.reps]))
  return reps.length ? reps.reduce((a, b) => a + b, 0) : null
}

/** Longest counted hold in seconds (null without durations). */
export function longestDuration(sets: CalcSet[]): number | null {
  const d = countedSets(sets).flatMap((s) => (s.durationSec === null ? [] : [s.durationSec]))
  return d.length ? Math.max(...d) : null
}
