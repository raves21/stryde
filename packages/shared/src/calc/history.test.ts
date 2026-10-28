import { describe, expect, it } from 'vitest'
import {
  type CalcSession,
  computeAllPRs,
  prTimeline,
  seriesForChart,
  sessionMetric,
} from './history'
import { type CalcSet, longestDuration, maxReps, totalReps } from './sets'

let n = 0
function s(weightKg: number | null, reps: number | null, over: Partial<CalcSet> = {}): CalcSet {
  n += 1
  return {
    id: `set-${n}`,
    setType: 'working',
    weightKg,
    reps,
    rir: null,
    durationSec: null,
    completedAt: '2026-01-01T10:00:00.000Z',
    deletedAt: null,
    ...over,
  }
}
const session = (day: number, sets: CalcSet[]): CalcSession => ({
  sessionId: `s${day}`,
  date: `2026-01-${String(day).padStart(2, '0')}`,
  at: `2026-01-${String(day).padStart(2, '0')}T11:00:00.000Z`,
  sets,
})

describe('per-session aggregates', () => {
  it.each<[string, (sets: CalcSet[]) => number | null, CalcSet[], number | null]>([
    ['maxReps', maxReps, [s(null, 10), s(null, 14), s(null, 30, { setType: 'warmup' })], 14],
    ['totalReps', totalReps, [s(null, 10), s(null, 14), s(null, 9, { completedAt: null })], 24],
    [
      'longestDuration',
      longestDuration,
      [s(null, null, { durationSec: 60 }), s(null, null, { durationSec: 75 })],
      75,
    ],
    ['maxReps without reps', maxReps, [s(null, null, { durationSec: 60 })], null],
  ])('%s', (_, f, sets, expected) => {
    expect(f(sets)).toBe(expected)
  })

  it.each([
    ['e1rm', [s(100, 5), s(80, 8)], 100 * (1 + 5 / 30)],
    ['best_set', [s(100, 5), s(80, 8)], 100],
    ['volume', [s(100, 5), s(80, 8)], 1140],
    ['volume (none)', [s(null, 10)], null],
  ] as const)('sessionMetric %s', (metric, sets, expected) => {
    const m = metric.split(' ')[0] as 'e1rm' | 'best_set' | 'volume'
    const v = sessionMetric(m, [...sets])
    if (expected === null) expect(v).toBeNull()
    else expect(v).toBeCloseTo(expected, 6)
  })
})

describe('prTimeline / computeAllPRs', () => {
  const sessions = [
    session(1, [s(100, 5)]), // baseline
    session(3, [s(105, 5)]), // e1rm, weight, volume
    session(5, [s(100, 5)]), // nothing
    session(8, [s(100, 8)]), // e1rm, reps_at_weight, volume
  ]

  it('lists PR events session by session, baseline excluded', () => {
    expect(prTimeline('weighted', sessions).map((e) => `${e.sessionId}:${e.prType}`)).toEqual([
      's3:e1rm',
      's3:weight',
      's3:volume',
      's8:e1rm',
      's8:reps_at_weight',
      's8:volume',
    ])
  })

  it('current records are the latest event of each type', () => {
    const records = computeAllPRs('weighted', sessions)
    expect(Object.fromEntries(records.map((r) => [r.prType, r.sessionId]))).toEqual({
      e1rm: 's8',
      weight: 's3',
      volume: 's8',
      reps_at_weight: 's8',
    })
    expect(records.find((r) => r.prType === 'weight')).toMatchObject({
      value: 105,
      achievedAt: '2026-01-03T11:00:00.000Z',
    })
  })

  it('editing an old session down lowers the records', () => {
    const edited = sessions.map((x) => (x.sessionId === 's3' ? session(3, [s(95, 5)]) : x))
    const records = computeAllPRs('weighted', edited)
    expect(records.find((r) => r.prType === 'weight')).toBeUndefined() // 100 never beaten
    expect(records.find((r) => r.prType === 'e1rm')?.sessionId).toBe('s8')
  })

  it('deleting the baseline makes the next session the baseline', () => {
    // s3 (105×5) is now the baseline; s8 (100×8) beats it on e1RM, reps at ≥100 kg and volume.
    expect(
      prTimeline('weighted', sessions.slice(1)).map((e) => `${e.sessionId}:${e.prType}`),
    ).toEqual(['s8:e1rm', 's8:reps_at_weight', 's8:volume'])
  })
})

describe('seriesForChart', () => {
  const sessions = [
    session(1, [s(100, 5)]),
    session(3, [s(105, 5)]),
    session(5, [s(null, null, { durationSec: 30 })]), // no e1rm value → skipped
    session(8, [s(100, 8)]),
  ]

  it('one point per session with a value, PR points marked', () => {
    expect(
      seriesForChart('weighted', sessions, 'best_set').map((p) => [p.date, p.value, p.isPR]),
    ).toEqual([
      ['2026-01-01', 100, false],
      ['2026-01-03', 105, true],
      ['2026-01-08', 100, false],
    ])
  })

  it('filters by range start, keeping PRs relative to all history', () => {
    const pts = seriesForChart('weighted', sessions, 'e1rm', '2026-01-03')
    expect(pts.map((p) => [p.date, p.isPR])).toEqual([
      ['2026-01-03', true],
      ['2026-01-08', true],
    ])
  })

  it('total reps never marks PRs', () => {
    const bw = [session(1, [s(null, 10)]), session(2, [s(null, 10), s(null, 10)])]
    expect(seriesForChart('bodyweight', bw, 'total_reps').map((p) => [p.value, p.isPR])).toEqual([
      [10, false],
      [20, false],
    ])
  })
})
