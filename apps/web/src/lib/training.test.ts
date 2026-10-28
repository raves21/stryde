import type { ExerciseRow, SessionExerciseRow, SessionRow, SetRow } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import { buildTraining, computeStats, weekDays } from './training'

const USER = 'u'
const AT = '2026-10-01T00:00:00.000Z'
const base = { userId: USER, createdAt: AT, updatedAt: AT, deletedAt: null }
const bench: ExerciseRow = {
  ...base,
  id: 'bench',
  userId: null,
  name: 'Bench',
  type: 'weighted',
  muscleGroup: 'chest',
  equipment: 'barbell',
  defaultRestSeconds: null,
  isPreset: true,
}

let n = 0
function workout(
  localDate: string,
  weightKg: number,
  reps: number,
  templateId: string | null = null,
) {
  n += 1
  const start = `${localDate}T10:00:00.000Z`
  const session: SessionRow = {
    ...base,
    id: `s${n}`,
    templateId,
    name: 'Push',
    startedAt: start,
    finishedAt: `${localDate}T11:05:00.000Z`,
    timezone: 'UTC',
    localDate,
    notes: null,
    shareWithFriends: true,
  }
  const se: SessionExerciseRow = {
    ...base,
    id: `se${n}`,
    sessionId: session.id,
    exerciseId: 'bench',
    position: 0,
    supersetGroup: null,
    restSeconds: null,
  }
  const mk = (i: number, over: Partial<SetRow>): SetRow => ({
    ...base,
    id: `set${n}-${i}`,
    sessionExerciseId: se.id,
    position: i,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: null,
    targetRepsMax: null,
    targetRir: null,
    weightKg,
    reps,
    rir: null,
    durationSec: null,
    completedAt: start,
    ...over,
  })
  return {
    session,
    se,
    sets: [
      mk(0, { setType: 'warmup', weightKg: 40, reps: 10 }),
      mk(1, {}),
      mk(2, { completedAt: null }),
    ],
  }
}

function build(...ws: ReturnType<typeof workout>[]) {
  return buildTraining({
    sessions: ws.map((w) => w.session),
    sessionExercises: ws.map((w) => w.se),
    sets: ws.flatMap((w) => w.sets),
    exercises: [bench],
  })
}

describe('buildTraining', () => {
  const a = workout('2026-10-05', 100, 5, 't1')
  const b = workout('2026-10-20', 110, 5, 't1')
  const c = workout('2026-10-27', 100, 5)
  const t = build(c, a, b)

  it('summarizes sessions newest first', () => {
    expect(t.sessions.map((s) => s.session.id)).toEqual([c.session.id, b.session.id, a.session.id])
    expect(t.byId.get(a.session.id)).toMatchObject({
      durationMs: 65 * 60_000,
      sets: 1,
      volumeKg: 500,
      exercises: 1,
      prs: [],
    })
  })

  it('marks PRs per session and per set, baseline excluded', () => {
    expect(
      t.byId
        .get(b.session.id)
        ?.prs.map((p) => p.prType)
        .sort(),
    ).toEqual(['e1rm', 'volume', 'weight'])
    expect(
      t.prsBySet
        .get(`set${b.session.id.slice(1)}-1`)
        ?.map((p) => p.prType)
        .sort(),
    ).toEqual(['e1rm', 'weight'])
    expect(t.recentPRs[0]?.sessionId).toBe(b.session.id)
    expect(t.exercises.get('bench')?.records.map((r) => r.sessionId)).toEqual([
      b.session.id,
      b.session.id,
      b.session.id,
    ])
  })

  it('collects trained days and template last-done times', () => {
    expect([...t.trainedDates].sort()).toEqual(['2026-10-05', '2026-10-20', '2026-10-27'])
    expect(t.lastDoneByTemplate.get('t1')).toBe(b.session.startedAt)
  })
})

describe('computeStats', () => {
  it.each([
    ['Wednesday 28 Oct', new Date(2026, 9, 28), { week: 1, month: 3, year: 3, total: 3 }],
    ['Sunday 1 Nov', new Date(2026, 10, 1), { week: 1, month: 0, year: 3, total: 3 }],
    ['Monday 2 Nov', new Date(2026, 10, 2), { week: 0, month: 0, year: 3, total: 3 }],
  ])('%s', (_, today, expected) => {
    const t = build(
      workout('2026-10-05', 100, 5),
      workout('2026-10-20', 110, 5),
      workout('2026-10-27', 100, 5),
    )
    const s = computeStats(t, today)
    expect({ week: s.week, month: s.month, year: s.year, total: s.total }).toEqual(expected)
    expect(s.volumeKg).toBe(500 + 550 + 500)
    expect(s.totalSets).toBe(3)
  })

  it('weekDays runs Monday to Sunday', () => {
    expect(weekDays(new Date(2026, 9, 28))).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
  })
})
