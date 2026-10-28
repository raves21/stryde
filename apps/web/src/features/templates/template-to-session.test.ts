import type { ExerciseRow, TemplateExerciseRow, TemplateSetRow } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import type { TemplateTree } from '@/db/repositories/templates'
import { templateToSession } from './template-to-session'

const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'
const AT = '2026-10-01T00:00:00.000Z'
const base = { userId: USER, createdAt: AT, updatedAt: AT, deletedAt: null }

function te(
  id: string,
  position: number,
  over: Partial<TemplateExerciseRow> = {},
): TemplateExerciseRow {
  return {
    ...base,
    id,
    templateId: 't1',
    exerciseId: `ex-${id}`,
    position,
    supersetGroup: null,
    restSeconds: null,
    ...over,
  }
}

function ts(id: string, position: number, over: Partial<TemplateSetRow> = {}): TemplateSetRow {
  return {
    ...base,
    id,
    templateExerciseId: 'x',
    position,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: 8,
    targetRepsMax: null,
    targetRir: null,
    plannedWeightKg: null,
    plannedDurationSec: null,
    ...over,
  }
}

const tree: TemplateTree = {
  template: { ...base, id: 't1', name: 'Push Day', notes: 'Heavy week', sortOrder: 0 },
  exercises: [
    {
      row: te('bench', 0, { restSeconds: 180 }),
      exercise: undefined as ExerciseRow | undefined,
      sets: [
        ts('w', 0, { setType: 'warmup', targetReps: 10, plannedWeightKg: 40 }),
        ts('r', 1, {
          targetKind: 'rir',
          targetReps: 8,
          targetRepsMax: 12,
          targetRir: 2,
          plannedWeightKg: 80,
        }),
        ts('f', 2, { targetKind: 'failure', targetReps: null, plannedWeightKg: 77.5 }),
      ],
    },
    { row: te('dips', 1, { supersetGroup: 'A' }), exercise: undefined, sets: [ts('d', 0)] },
    {
      row: te('plank', 2, { supersetGroup: 'A' }),
      exercise: undefined,
      sets: [ts('p', 0, { targetReps: null, plannedDurationSec: 90 })],
    },
  ],
}

function build(now = new Date('2026-10-28T20:30:00.000Z'), timezone = 'Asia/Manila') {
  let n = 0
  return templateToSession(tree, {
    userId: USER,
    now,
    timezone,
    shareWithFriends: false,
    newId: () => `id-${++n}`,
  })
}

describe('templateToSession', () => {
  it('creates an active session named after the template', () => {
    const { session } = build()
    expect(session).toMatchObject({
      id: 'id-1',
      userId: USER,
      templateId: 't1',
      name: 'Push Day',
      startedAt: '2026-10-28T20:30:00.000Z',
      finishedAt: null,
      timezone: 'Asia/Manila',
      shareWithFriends: false,
      deletedAt: null,
    })
  })

  it.each([
    ['Asia/Manila', '2026-10-29'],
    ['America/New_York', '2026-10-28'],
    ['UTC', '2026-10-28'],
  ])('computes localDate in %s', (tz, expected) => {
    expect(build(undefined, tz).session.localDate).toBe(expected)
  })

  it('copies exercise order, supersets and rest', () => {
    const { session, sessionExercises } = build()
    expect(
      sessionExercises.map((se) => [se.exerciseId, se.position, se.supersetGroup, se.restSeconds]),
    ).toEqual([
      ['ex-bench', 0, null, 180],
      ['ex-dips', 1, 'A', null],
      ['ex-plank', 2, 'A', null],
    ])
    expect(sessionExercises.every((se) => se.sessionId === session.id)).toBe(true)
  })

  it('copies targets and planned weights and applies the target pre-fill rules', () => {
    const { sets } = build()
    expect(
      sets.map((s) => ({
        setType: s.setType,
        targetKind: s.targetKind,
        targets: [s.targetReps, s.targetRepsMax, s.targetRir],
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
        durationSec: s.durationSec,
        completedAt: s.completedAt,
      })),
    ).toEqual([
      {
        setType: 'warmup',
        targetKind: 'fixed',
        targets: [10, null, null],
        weightKg: 40,
        reps: 10,
        rir: null,
        durationSec: null,
        completedAt: null,
      },
      {
        setType: 'working',
        targetKind: 'rir',
        targets: [8, 12, 2],
        weightKg: 80,
        reps: null,
        rir: 2,
        durationSec: null,
        completedAt: null,
      },
      {
        setType: 'working',
        targetKind: 'failure',
        targets: [null, null, null],
        weightKg: 77.5,
        reps: null,
        rir: 0,
        durationSec: null,
        completedAt: null,
      },
      {
        setType: 'working',
        targetKind: 'fixed',
        targets: [8, null, null],
        weightKg: null,
        reps: 8,
        rir: null,
        durationSec: null,
        completedAt: null,
      },
      {
        setType: 'working',
        targetKind: 'fixed',
        targets: [null, null, null],
        weightKg: null,
        reps: null,
        rir: null,
        durationSec: 90,
        completedAt: null,
      },
    ])
  })

  it('generates new ids and links sets to their new session exercise', () => {
    const { session, sessionExercises, sets } = build()
    const ids = [session.id, ...sessionExercises.map((r) => r.id), ...sets.map((r) => r.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(
      ids.some((id) => ['t1', 'bench', 'dips', 'plank', 'w', 'r', 'f', 'd', 'p'].includes(id)),
    ).toBe(false)
    const [bench, dips, plank] = sessionExercises
    expect(sets.map((s) => s.sessionExerciseId)).toEqual([
      bench?.id,
      bench?.id,
      bench?.id,
      dips?.id,
      plank?.id,
    ])
    expect(sets.filter((s) => s.sessionExerciseId === bench?.id).map((s) => s.position)).toEqual([
      0, 1, 2,
    ])
  })
})
