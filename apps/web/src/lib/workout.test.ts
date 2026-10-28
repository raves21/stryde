import type { SessionExerciseRow, SetRow } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import {
  formatElapsed,
  formatPrevious,
  matchPrevious,
  parseDuration,
  prefill,
  restAfter,
  targetKindPatch,
} from './workout'

type Prev = Pick<SetRow, 'setType' | 'weightKg' | 'reps' | 'rir' | 'durationSec'> & { id: string }
const prev = (
  id: string,
  setType: 'warmup' | 'working',
  weightKg: number | null,
  reps: number | null,
): Prev => ({
  id,
  setType,
  weightKg,
  reps,
  rir: null,
  durationSec: null,
})

describe('matchPrevious', () => {
  it('matches warm-ups and working sets by their own index', () => {
    const previous = [
      prev('w1', 'warmup', 40, 10),
      prev('a', 'working', 80, 8),
      prev('b', 'working', 80, 7),
    ]
    const now = [
      { setType: 'working' },
      { setType: 'warmup' },
      { setType: 'working' },
      { setType: 'working' },
      { setType: 'warmup' },
    ] as const
    expect(matchPrevious([...now], previous).map((p) => p?.id)).toEqual([
      'a',
      'w1',
      'b',
      undefined,
      undefined,
    ])
  })
})

describe('prefill', () => {
  const p = { weightKg: 80, reps: 8, rir: 1, durationSec: 45 }
  it.each<[string, Parameters<typeof prefill>, ReturnType<typeof prefill>]>([
    [
      'fixed: previous weight, target reps',
      [
        { targetKind: 'fixed', targetReps: 10, targetRir: null },
        p,
        { weightKg: 70, durationSec: null },
      ],
      { weightKg: 80, reps: 10, rir: null, durationSec: 45 },
    ],
    [
      'fixed without previous: planned weight',
      [
        { targetKind: 'fixed', targetReps: 10, targetRir: null },
        undefined,
        { weightKg: 70, durationSec: null },
      ],
      { weightKg: 70, reps: 10, rir: null, durationSec: null },
    ],
    [
      'fixed without target: previous reps',
      [{ targetKind: 'fixed', targetReps: null, targetRir: null }, p],
      { weightKg: 80, reps: 8, rir: null, durationSec: 45 },
    ],
    [
      'rir: reps empty, rir = target',
      [{ targetKind: 'rir', targetReps: 8, targetRir: 2 }, p],
      { weightKg: 80, reps: null, rir: 2, durationSec: 45 },
    ],
    [
      'failure: reps empty, rir 0',
      [{ targetKind: 'failure', targetReps: null, targetRir: null }, p],
      { weightKg: 80, reps: null, rir: 0, durationSec: 45 },
    ],
    [
      'nothing known',
      [{ targetKind: 'fixed', targetReps: null, targetRir: null }, undefined],
      { weightKg: null, reps: null, rir: null, durationSec: null },
    ],
    [
      'timed: planned duration wins',
      [
        { targetKind: 'fixed', targetReps: null, targetRir: null },
        p,
        { weightKg: null, durationSec: 90 },
      ],
      { weightKg: 80, reps: 8, rir: null, durationSec: 90 },
    ],
  ])('%s', (_, args, expected) => {
    expect(prefill(...args)).toEqual(expected)
  })
})

describe('targetKindPatch', () => {
  it.each([
    [
      'rir keeps a target, defaults to 2',
      { targetRir: null, rir: null },
      'rir',
      { targetKind: 'rir', targetRir: 2, rir: 2 },
    ],
    [
      'rir keeps an entered rir',
      { targetRir: 3, rir: 1 },
      'rir',
      { targetKind: 'rir', targetRir: 3, rir: 1 },
    ],
    [
      'failure locks rir to 0',
      { targetRir: 2, rir: 2 },
      'failure',
      { targetKind: 'failure', targetRir: null, rir: 0 },
    ],
    [
      'fixed clears rir',
      { targetRir: 2, rir: 2 },
      'fixed',
      { targetKind: 'fixed', targetRir: null, rir: null },
    ],
  ] as const)('%s', (_, set, kind, expected) => {
    expect(targetKindPatch(set, kind)).toEqual(expected)
  })
})

describe('restAfter', () => {
  const se = (id: string, position: number, over: Partial<SessionExerciseRow> = {}) =>
    ({
      id,
      position,
      supersetGroup: null,
      restSeconds: null,
      deletedAt: null,
      ...over,
    }) as SessionExerciseRow
  const bench = se('bench', 0, { restSeconds: 180 })
  const a1 = se('a1', 1, { supersetGroup: 'A', restSeconds: 30 })
  const a2 = se('a2', 2, { supersetGroup: 'A', restSeconds: 90 })
  const curl = se('curl', 3)
  const all = [bench, a1, a2, curl]
  const run = (
    setType: 'warmup' | 'working',
    s: SessionExerciseRow,
    exerciseRest: number | null = null,
  ) =>
    restAfter({
      set: { setType },
      sessionExercise: s,
      sessionExercises: all,
      exercise: { defaultRestSeconds: exerciseRest },
      defaultRestSeconds: 120,
    })

  it.each<[string, () => number | null, number | null]>([
    ['session exercise rest first', () => run('working', bench, 150), 180],
    ['then the exercise default', () => run('working', curl, 75), 75],
    ['then the user default', () => run('working', curl), 120],
    ['no rest after a warm-up', () => run('warmup', bench), null],
    ['no rest mid-superset', () => run('working', a1), null],
    ['rest after the last exercise of the round', () => run('working', a2), 90],
  ])('%s', (_, f, expected) => {
    expect(f()).toBe(expected)
  })
})

describe('formatting', () => {
  it.each<[Parameters<typeof formatPrevious>, string]>([
    [
      [{ weightKg: 80, reps: 8, rir: 1, durationSec: null, targetKind: 'rir' }, 'weighted', 'kg'],
      '80×8 @1',
    ],
    [
      [
        { weightKg: 80, reps: 7, rir: 0, durationSec: null, targetKind: 'failure' },
        'weighted',
        'kg',
      ],
      '80×7 F',
    ],
    [
      [
        { weightKg: 40, reps: 10, rir: null, durationSec: null, targetKind: 'fixed' },
        'weighted',
        'kg',
      ],
      '40×10',
    ],
    [
      [
        { weightKg: 100, reps: 5, rir: null, durationSec: null, targetKind: 'fixed' },
        'weighted',
        'lb',
      ],
      '220.5×5',
    ],
    [
      [
        { weightKg: 10, reps: 6, rir: 0, durationSec: null, targetKind: 'failure' },
        'bodyweight',
        'kg',
      ],
      '+10×6 F',
    ],
    [
      [
        { weightKg: null, reps: 12, rir: null, durationSec: null, targetKind: 'fixed' },
        'bodyweight',
        'kg',
      ],
      '×12',
    ],
    [
      [
        { weightKg: null, reps: null, rir: null, durationSec: 90, targetKind: 'fixed' },
        'timed',
        'kg',
      ],
      '1:30',
    ],
    [
      [
        { weightKg: 20, reps: null, rir: null, durationSec: 90, targetKind: 'fixed' },
        'timed',
        'kg',
      ],
      '20 kg · 1:30',
    ],
  ])('formatPrevious → %s', (args, expected) => {
    expect(formatPrevious(...args)).toBe(expected)
  })

  it.each([
    ['1:30', 90],
    ['90', 90],
    ['0:05', 5],
    ['', null],
    ['1:75', undefined],
    ['abc', undefined],
  ] as const)('parseDuration(%s) = %s', (text, expected) => {
    expect(parseDuration(text)).toBe(expected)
  })

  it.each([
    [0, '0:00'],
    [65_000, '1:05'],
    [32 * 60_000 + 14_000, '32:14'],
    [3600_000 + 12 * 60_000 + 48_000, '1:12:48'],
    [-5000, '0:00'],
  ])('formatElapsed(%d) = %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected)
  })
})
