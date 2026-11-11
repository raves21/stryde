import type { ExerciseRow, SessionExerciseRow, SessionRow, SetRow } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import { buildTraining, computeSportStats, computeStats, weekDays } from './training'

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

const pickleball: ExerciseRow = {
  ...bench,
  id: 'pickleball',
  name: 'Pickleball',
  type: 'sport',
  muscleGroup: 'cardio',
  equipment: 'other',
}

let n = 0

/** A finished sport session of `minutes` on `localDate`: one sport exercise, one timed set. */
/** A sport session of games (minutes each) with a 10-minute break between them. */
function sport(localDate: string, ...games: number[]) {
  const span = games.reduce((a, b) => a + b, 0) + 10 * (games.length - 1)
  n += 1
  const start = `${localDate}T18:00:00.000Z`
  const session: SessionRow = {
    ...base,
    id: `sport${n}`,
    templateId: null,
    name: 'Pickleball',
    startedAt: start,
    finishedAt: new Date(Date.parse(start) + span * 60_000).toISOString(),
    timezone: 'UTC',
    localDate,
    notes: null,
    shareWithFriends: true,
  }
  const se: SessionExerciseRow = {
    ...base,
    id: `sportse${n}`,
    sessionId: session.id,
    exerciseId: 'pickleball',
    position: 0,
    supersetGroup: null,
    restSeconds: null,
  }
  const sets: SetRow[] = games.map((minutes, i) => ({
    ...base,
    id: `sportset${n}-${i}`,
    sessionExerciseId: se.id,
    position: i,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: null,
    targetRepsMax: null,
    targetRir: null,
    weightKg: null,
    reps: null,
    rir: null,
    durationSec: minutes * 60,
    completedAt: session.finishedAt,
  }))
  return { session, se, sets }
}

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
    exercises: [bench, pickleball],
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
    // The week runs Sunday to Saturday: Sat 31 Oct is still the week of Sun 25 Oct...
    ['Saturday 31 Oct', new Date(2026, 9, 31), { week: 1, month: 3, year: 3, total: 3 }],
    // ...and Sun 1 Nov starts a new one.
    ['Sunday 1 Nov', new Date(2026, 10, 1), { week: 0, month: 0, year: 3, total: 3 }],
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

  it('weekDays runs Sunday to Saturday', () => {
    expect(weekDays(new Date(2026, 9, 28))).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
    // A Sunday starts its own week.
    expect(weekDays(new Date(2026, 10, 1))[0]).toBe('2026-11-01')
  })
})

describe('sport sessions in the training summary', () => {
  const lift = workout('2026-10-27', 100, 5)
  const p1 = sport('2026-10-26', 45, 45) // Monday of the week of Sun 25 Oct; 100 min on the clock
  const p2 = sport('2026-10-12', 60)
  const t = build(lift, p1, p2)

  it('flags them; their time is the games played, not the span; no PRs or volume', () => {
    expect(t.byId.get(p1.session.id)).toMatchObject({
      sport: true,
      sportId: 'pickleball',
      sets: 2,
      durationMs: 90 * 60_000,
      volumeKg: 0,
      prs: [],
    })
    expect(t.byId.get(lift.session.id)?.sport).toBe(false)
    expect(t.exercises.get('pickleball')?.events).toEqual([])
  })

  it('still marks their days as trained (calendar, week strip)', () => {
    expect([...t.trainedDates].sort()).toEqual(['2026-10-12', '2026-10-26', '2026-10-27'])
  })

  it('computeStats is gym only: sports are not workouts, volume or sets', () => {
    const s = computeStats(t, new Date(2026, 9, 28)) // Wednesday; week starts Sun 25 Oct
    expect({ week: s.week, month: s.month, year: s.year, total: s.total }).toEqual({
      week: 1,
      month: 1,
      year: 1,
      total: 1,
    })
    expect(s.volumeKg).toBe(500)
    expect(s.totalSets).toBe(1)
  })

  it('a week with only sport has zero workouts', () => {
    expect(computeStats(build(p1), new Date(2026, 9, 28)).week).toBe(0)
  })

  it('computeSportStats: sessions, games and time played, per sport', () => {
    const s = computeSportStats(t, new Date(2026, 9, 28))
    expect(s).toMatchObject({
      sessionsWeek: 1,
      sessionsMonth: 2,
      sessionsTotal: 2,
      playMsWeek: 90 * 60_000,
      playMsMonth: 150 * 60_000,
      playMsTotal: 150 * 60_000,
      gamesTotal: 3,
    })
    expect(s.bySport).toEqual([
      expect.objectContaining({ sessions: 2, games: 3, playMs: 150 * 60_000 }),
    ])
    expect(s.bySport[0]?.exercise.id).toBe('pickleball')
  })

  it('computeSportStats is empty without sports', () => {
    expect(computeSportStats(build(lift), new Date(2026, 9, 28))).toMatchObject({
      sessionsTotal: 0,
      playMsTotal: 0,
      bySport: [],
    })
  })
})
