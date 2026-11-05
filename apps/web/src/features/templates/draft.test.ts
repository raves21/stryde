import type { ExerciseRow } from '@stryde/shared'
import { describe, expect, it } from 'vitest'
import {
  addExercise,
  addSet,
  draftSignature,
  groupExercises,
  newDraft,
  removeExercise,
  removeSet,
  reorderExercises,
  setTemplateText,
  ungroupExercises,
  updateExercise,
  updateSet,
} from './draft'

const NOW = '2026-11-05T10:00:00.000Z'
const exercise = (id: string, name = id): ExerciseRow =>
  ({ id, name, type: 'weighted', muscleGroup: 'chest', equipment: 'barbell' }) as ExerciseRow

/** A draft with exercises e1..en (each with one set s1..sn). */
function draftWith(n: number) {
  let tree = newDraft('t1', NOW)
  for (let i = 1; i <= n; i++) {
    tree = addExercise(tree, exercise(`x${i}`), { rowId: `e${i}`, setId: `s${i}` }, NOW)
  }
  return tree
}
const order = (t: ReturnType<typeof draftWith>) => t.exercises.map((e) => e.row.id)
const groups = (t: ReturnType<typeof draftWith>) => t.exercises.map((e) => e.row.supersetGroup)

describe('template draft', () => {
  it('starts blank and not saved anywhere', () => {
    const d = newDraft('t1', NOW)
    expect(d.template).toMatchObject({ id: 't1', name: '', notes: null })
    expect(d.exercises).toEqual([])
  })

  it('an added exercise gets the next position and one plain working set', () => {
    const d = draftWith(2)
    expect(d.exercises.map((e) => e.row.position)).toEqual([0, 1])
    expect(d.exercises[1]?.row).toMatchObject({
      templateId: 't1',
      exerciseId: 'x2',
      supersetGroup: null,
    })
    expect(d.exercises[1]?.sets).toEqual([
      expect.objectContaining({
        id: 's2',
        templateExerciseId: 'e2',
        position: 0,
        setType: 'working',
        targetKind: 'fixed',
      }),
    ])
    expect(d.exercises[1]?.exercise?.name).toBe('x2')
  })

  it('"add set" copies the last set (a warm-up copies as working) and numbers it after it', () => {
    let d = draftWith(1)
    d = updateSet(d, 's1', {
      setType: 'warmup',
      targetKind: 'rir',
      targetReps: 8,
      targetRepsMax: 12,
      targetRir: 2,
      plannedWeightKg: 60,
    })
    d = addSet(d, 'e1', 's1b', NOW)
    expect(d.exercises[0]?.sets[1]).toMatchObject({
      id: 's1b',
      position: 1,
      setType: 'working',
      targetKind: 'rir',
      targetReps: 8,
      targetRepsMax: 12,
      targetRir: 2,
      plannedWeightKg: 60,
    })
  })

  it('updates and removes sets, leaving other exercises alone', () => {
    let d = draftWith(2)
    d = updateSet(d, 's2', { plannedWeightKg: 100 })
    expect(d.exercises[0]?.sets[0]?.plannedWeightKg).toBeNull()
    expect(d.exercises[1]?.sets[0]?.plannedWeightKg).toBe(100)
    d = removeSet(d, 's2')
    expect(d.exercises[1]?.sets).toEqual([])
    expect(d.exercises[0]?.sets).toHaveLength(1)
  })

  it('reorders and renumbers positions', () => {
    const d = reorderExercises(draftWith(3), ['e3', 'e1', 'e2'], 'e3')
    expect(order(d)).toEqual(['e3', 'e1', 'e2'])
    expect(d.exercises.map((e) => e.row.position)).toEqual([0, 1, 2])
  })

  it('groups exercises into a superset next to each other, and ungroups them', () => {
    let d = groupExercises(draftWith(4), ['e1', 'e3'])
    expect(order(d)).toEqual(['e1', 'e3', 'e2', 'e4'])
    expect(groups(d)).toEqual(['A', 'A', null, null])
    d = ungroupExercises(d, ['e1', 'e3'])
    expect(groups(d)).toEqual([null, null, null, null])
  })

  it.each([
    [
      'dropping one out of a pair dissolves the pair',
      ['e1', 'e2', 'e3', 'e4'],
      'e1',
      ['e2', 'e3', 'e1', 'e4'],
      [null, null, null, null],
    ],
    [
      'dropping a third member between keeps the group',
      ['e1', 'e2', 'e3'],
      'e3',
      ['e1', 'e3', 'e2'],
      [null, null, null],
    ],
  ])('moving in a superset: %s', (_, start, moved, next) => {
    let d = groupExercises(draftWith(start.length), start.slice(0, 2))
    d = reorderExercises(d, next, moved)
    expect(order(d)).toEqual(next)
  })

  it('removing an exercise renumbers, and a superset left with one member is cleared', () => {
    let d = groupExercises(draftWith(3), ['e1', 'e2'])
    d = removeExercise(d, 'e2')
    expect(order(d)).toEqual(['e1', 'e3'])
    expect(d.exercises.map((e) => e.row.position)).toEqual([0, 1])
    expect(groups(d)).toEqual([null, null])
  })

  it('updates an exercise (rest) and the template text', () => {
    let d = updateExercise(draftWith(2), 'e2', { restSeconds: 90 })
    expect(d.exercises.map((e) => e.row.restSeconds)).toEqual([null, 90])
    d = setTemplateText(d, { name: 'Push', notes: 'Heavy' })
    expect(d.template).toMatchObject({ name: 'Push', notes: 'Heavy' })
  })

  describe('signature (what counts as unsaved)', () => {
    it('ignores whitespace around the text and row bookkeeping, sees real edits', () => {
      const base = setTemplateText(draftWith(1), { name: 'Push', notes: null })
      const same = setTemplateText(base, { name: '  Push  ', notes: '   ' })
      expect(draftSignature(same)).toBe(draftSignature(base))

      const edits = [
        setTemplateText(base, { name: 'Pull' }),
        setTemplateText(base, { notes: 'x' }),
        addExercise(base, exercise('x9'), { rowId: 'e9', setId: 's9' }, NOW),
        removeExercise(base, 'e1'),
        updateExercise(base, 'e1', { restSeconds: 60 }),
        updateSet(base, 's1', { targetReps: 5 }),
        addSet(base, 'e1', 's1b', NOW),
      ]
      for (const edited of edits) expect(draftSignature(edited)).not.toBe(draftSignature(base))
    })

    it('is unchanged by an edit that is undone', () => {
      const base = draftWith(2)
      const undone = updateSet(updateSet(base, 's1', { targetReps: 5 }), 's1', { targetReps: null })
      expect(draftSignature(undone)).toBe(draftSignature(base))
    })
  })
})
