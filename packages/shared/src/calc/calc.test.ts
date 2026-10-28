import { describe, expect, it } from 'vitest'
import { detectPRs } from './prs'
import { bestSet, type CalcSet, e1rm, effectiveReps, sessionVolume } from './sets'

let n = 0
/** A completed working set: s(80, 8) / s(80, 8, { rir: 2 }). */
function s(weightKg: number | null, reps: number | null, over: Partial<CalcSet> = {}): CalcSet {
  n += 1
  return {
    id: `set-${n}`,
    setType: 'working',
    weightKg,
    reps,
    rir: null,
    durationSec: null,
    completedAt: '2026-10-28T10:00:00.000Z',
    deletedAt: null,
    ...over,
  }
}
const warmup = (w: number, r: number) => s(w, r, { setType: 'warmup' })
const timed = (sec: number) => s(null, null, { durationSec: sec })

describe('effectiveReps / e1rm', () => {
  it.each<[string, CalcSet, number | null, number | null]>([
    ['fixed 100×5', s(100, 5), 5, 100 * (1 + 5 / 30)],
    ['RIR set adds reps in reserve', s(80, 8, { rir: 2 }), 10, 80 * (1 + 10 / 30)],
    ['failure set (rir 0)', s(80, 7, { rir: 0 }), 7, 80 * (1 + 7 / 30)],
    ['single at RIR 0 is the weight', s(140, 1, { rir: 0 }), 1, 140],
    ['single without rir is the weight', s(140, 1), 1, 140],
    ['single with RIR is Epley', s(140, 1, { rir: 1 }), 2, 140 * (1 + 2 / 30)],
    ['15 effective reps is still computed', s(50, 13, { rir: 2 }), 15, 50 * 1.5],
    ['over 15 effective reps is null', s(50, 14, { rir: 2 }), 16, null],
    ['no weight', s(null, 10), 10, null],
    ['zero (bodyweight without added weight)', s(0, 10), 10, null],
    ['no reps', s(80, null), null, null],
  ])('%s', (_, set, reps, expected) => {
    expect(effectiveReps(set)).toBe(reps)
    if (expected === null) expect(e1rm(set)).toBeNull()
    else expect(e1rm(set)).toBeCloseTo(expected, 6)
  })
})

describe('sessionVolume / bestSet', () => {
  it('sums weight × reps of completed working sets only', () => {
    const sets = [
      warmup(40, 10),
      s(80, 8),
      s(80, 7, { rir: 0 }),
      s(80, 6, { completedAt: null }),
      s(80, 6, { deletedAt: '2026-10-28T11:00:00.000Z' }),
    ]
    expect(sessionVolume(sets)).toBe(80 * 8 + 80 * 7)
  })

  it('best set is the highest e1RM, ignoring warm-ups', () => {
    // 90×5 ≈ 105 beats 80×8 ≈ 101.3 and 60×12 = 84.
    const best = s(90, 5)
    expect(bestSet([warmup(200, 1), s(80, 8), best, s(60, 12)])?.id).toBe(best.id)
    expect(bestSet([warmup(40, 10)])).toBeNull()
  })

  it('falls back to weight, then reps, when e1RM is unavailable', () => {
    const heavy = s(20, 20)
    expect(bestSet([s(10, 25), heavy, s(20, 18)])?.id).toBe(heavy.id)
  })
})

describe('detectPRs', () => {
  const types = (prs: ReturnType<typeof detectPRs>) => prs.map((p) => p.prType).sort()

  it('the first session is a baseline, not PRs', () => {
    expect(detectPRs('weighted', [], [s(100, 5)])).toEqual([])
    expect(detectPRs('weighted', [[warmup(40, 10)], []], [s(100, 5)])).toEqual([])
  })

  it.each<[string, 'weighted' | 'bodyweight' | 'timed', CalcSet[][], CalcSet[], string[]]>([
    ['no improvement', 'weighted', [[s(100, 5)]], [s(100, 5)], []],
    [
      'heavier weight → e1rm, weight, volume',
      'weighted',
      [[s(100, 5)]],
      [s(105, 5)],
      ['e1rm', 'volume', 'weight'],
    ],
    [
      'more reps at the same weight → e1rm, reps_at_weight, volume',
      'weighted',
      [[s(100, 5)]],
      [s(100, 6)],
      ['e1rm', 'reps_at_weight', 'volume'],
    ],
    [
      'more sets, same top set → volume only',
      'weighted',
      [[s(100, 5)]],
      [s(100, 5), s(100, 5)],
      ['volume'],
    ],
    [
      'more reps at a lighter weight than ever done → nothing new',
      'weighted',
      [[s(100, 5)]],
      [s(60, 5)],
      [],
    ],
    [
      'reps at a lighter weight beat a heavier set',
      'weighted',
      [[s(100, 5), s(80, 8)]],
      [s(90, 6)],
      ['reps_at_weight'],
    ],
    ['warm-ups never count', 'weighted', [[s(100, 5)]], [warmup(150, 5), s(100, 5)], []],
    [
      'RIR counts toward e1RM',
      'weighted',
      [[s(100, 5, { rir: 0 })]],
      [s(100, 5, { rir: 2 })],
      ['e1rm'],
    ],
    [
      'bodyweight: more reps without added weight → max_reps',
      'bodyweight',
      [[s(null, 10)]],
      [s(null, 12)],
      ['max_reps'],
    ],
    [
      'bodyweight: added weight → e1rm and weight',
      'bodyweight',
      [[s(5, 6)]],
      [s(10, 6)],
      ['e1rm', 'weight'],
    ],
    [
      'bodyweight: first time with added weight vs unloaded history',
      'bodyweight',
      [[s(null, 12)]],
      [s(10, 6)],
      ['e1rm', 'weight'],
    ],
    ['timed: longer hold → duration', 'timed', [[timed(60)]], [timed(90)], ['duration']],
    ['timed: shorter hold → nothing', 'timed', [[timed(60)]], [timed(45)], []],
    ['reps > 15 has no e1RM', 'weighted', [[s(20, 20)]], [s(20, 22)], ['reps_at_weight', 'volume']],
  ])('%s', (_, type, history, session, expected) => {
    expect(types(detectPRs(type, history, session))).toEqual(expected)
  })

  it('reports value, previous best and the set', () => {
    const best = s(110, 3)
    const prs = detectPRs('weighted', [[s(100, 5)], [s(105, 2)]], [s(90, 5), best])
    expect(prs.find((p) => p.prType === 'weight')).toEqual({
      prType: 'weight',
      value: 110,
      previous: 105,
      setId: best.id,
    })
    const e1rmPr = prs.find((p) => p.prType === 'e1rm')
    expect(e1rmPr?.setId).toBe(best.id)
    expect(e1rmPr?.value).toBeCloseTo(121, 6)
  })

  it('an edited history can lower the bar again', () => {
    const session = [s(100, 5)]
    expect(types(detectPRs('weighted', [[s(110, 5)]], session))).toEqual([])
    // The 110 kg session was edited down to 90 kg.
    expect(types(detectPRs('weighted', [[s(90, 5)]], session))).toEqual([
      'e1rm',
      'volume',
      'weight',
    ])
  })
})
