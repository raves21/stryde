import type { CalcSet, ExerciseType } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import { setPRHints } from './set-pr-hints'

let n = 0
const set = (over: Partial<CalcSet> = {}): CalcSet => ({
  id: `set-${++n}`,
  setType: 'working',
  weightKg: 80,
  reps: 8,
  rir: null,
  durationSec: null,
  completedAt: '2026-11-03T10:00:00.000Z',
  deletedAt: null,
  ...over,
})

const labelsOf = (type: ExerciseType, history: CalcSet[][], sets: CalcSet[]) =>
  Object.fromEntries([...setPRHints(type, history, sets)].map(([id, label]) => [id, label]))

describe('setPRHints', () => {
  it('has no hints for the first session of an exercise (baseline)', () => {
    expect(labelsOf('weighted', [], [set()])).toEqual({})
  })

  it('labels a heavier set with the e1RM PR (first PR type wins)', () => {
    const best = set({ weightKg: 90, reps: 8 })
    expect(labelsOf('weighted', [[set()]], [set(), best])).toEqual({ [best.id]: 'e1RM PR' })
  })

  it('has no hint when the set does not beat history', () => {
    expect(labelsOf('weighted', [[set({ weightKg: 100 })]], [set()])).toEqual({})
  })

  it('ignores sets that are not completed yet', () => {
    expect(labelsOf('weighted', [[set()]], [set({ weightKg: 100, completedAt: null })])).toEqual({})
  })

  it('moves the chip to the later set that beats the earlier one', () => {
    const first = set({ weightKg: 85 })
    const second = set({ weightKg: 90 })
    expect(labelsOf('weighted', [[set()]], [first, second])).toEqual({ [second.id]: 'e1RM PR' })
  })

  it('labels bodyweight reps and timed duration', () => {
    const reps = set({ weightKg: null, reps: 12 })
    expect(labelsOf('bodyweight', [[set({ weightKg: null, reps: 10 })]], [reps])).toEqual({
      [reps.id]: 'Reps PR',
    })
    const hold = set({ weightKg: null, reps: null, durationSec: 90 })
    expect(
      labelsOf('timed', [[set({ weightKg: null, reps: null, durationSec: 60 })]], [hold]),
    ).toEqual({ [hold.id]: 'Time PR' })
  })

  it('never labels warm-ups', () => {
    expect(labelsOf('weighted', [[set()]], [set({ setType: 'warmup', weightKg: 200 })])).toEqual({})
  })
})
