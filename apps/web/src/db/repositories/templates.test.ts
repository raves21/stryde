import { afterEach, describe, expect, it } from 'vitest'
import type { NewRow } from '@/db/repositories/core'
import { signedInDb } from '@/test/local-db'
import type { StrydeDb } from '../db'
import { createExercise } from './exercises'
import { normalizeSupersets } from './supersets'
import {
  addNextTemplateSet,
  addTemplateExercise,
  addTemplateSet,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateTree,
  groupSuperset,
  listTemplateSummaries,
  removeTemplateExercise,
  reorderTemplateExercises,
  ungroupSuperset,
} from './templates'

const USER = '01a16d28-9e71-700c-8c73-3421a4a90d4e'

function plannedSet(templateExerciseId: string, position: number): NewRow<'templateSets'> {
  return {
    templateExerciseId,
    position,
    setType: position === 0 ? 'warmup' : 'working',
    targetKind: 'rir',
    targetReps: 8,
    targetRepsMax: 12,
    targetRir: 2,
    plannedWeightKg: 60 + position * 10,
    plannedDurationSec: null,
  }
}

/** "Push Day" with three exercises, two sets each. */
async function pushDay(db: StrydeDb) {
  const t = await createTemplate({ name: 'Push Day', notes: 'Heavy' }, db)
  const ids: string[] = []
  for (const [position, name] of ['Bench', 'Incline DB', 'Dips'].entries()) {
    const ex = await createExercise(
      { name, type: 'weighted', muscleGroup: 'chest', equipment: 'barbell' },
      db,
    )
    const te = await addTemplateExercise(
      { templateId: t.id, exerciseId: ex.id, position, restSeconds: 120 },
      db,
    )
    ids.push(te.id)
    await addTemplateSet(plannedSet(te.id, 0), db)
    await addTemplateSet(plannedSet(te.id, 1), db)
  }
  return { t, ids }
}

describe('template repository', () => {
  let db: StrydeDb
  afterEach(async () => {
    await db.delete()
  })

  it('duplicates a template deeply with new ids', async () => {
    db = await signedInDb(USER)
    const { t } = await pushDay(db)
    const copy = await duplicateTemplate(t.id, db)
    const original = await getTemplateTree(t.id, db)
    const duplicate = await getTemplateTree(copy.id, db)
    if (!original || !duplicate) throw new Error('missing tree')

    expect(duplicate.template).toMatchObject({ name: 'Push Day (copy)', notes: 'Heavy' })
    expect(duplicate.template.sortOrder).toBeGreaterThan(original.template.sortOrder)
    const strip = (tree: typeof original) =>
      tree.exercises.map((e) => ({
        exerciseId: e.row.exerciseId,
        position: e.row.position,
        restSeconds: e.row.restSeconds,
        sets: e.sets.map(
          ({
            setType,
            targetKind,
            targetReps,
            targetRepsMax,
            targetRir,
            plannedWeightKg,
            position,
          }) => ({
            setType,
            targetKind,
            targetReps,
            targetRepsMax,
            targetRir,
            plannedWeightKg,
            position,
          }),
        ),
      }))
    expect(strip(duplicate)).toEqual(strip(original))

    const originalIds = new Set([
      ...original.exercises.map((e) => e.row.id),
      ...original.exercises.flatMap((e) => e.sets.map((s) => s.id)),
    ])
    const copyIds = [
      ...duplicate.exercises.map((e) => e.row.id),
      ...duplicate.exercises.flatMap((e) => e.sets.map((s) => s.id)),
    ]
    expect(copyIds.some((id) => originalIds.has(id))).toBe(false)
    expect(duplicate.exercises.every((e) => e.row.templateId === copy.id)).toBe(true)
    // Every copied row is queued for sync.
    expect(await db.outbox.where('table').equals('templateSets').count()).toBe(12)
  })

  it('a new set copies the stored last set (a warm-up copies as working)', async () => {
    db = await signedInDb(USER)
    const { t } = await pushDay(db)
    const te = (await getTemplateTree(t.id, db))?.exercises[0]?.row
    const next = await addNextTemplateSet(te?.id ?? '', db)
    expect(next).toMatchObject({
      position: 2,
      setType: 'working',
      targetKind: 'rir',
      targetReps: 8,
      targetRepsMax: 12,
      targetRir: 2,
      plannedWeightKg: 70,
    })
  })

  it('leaves the original alone when the copy is deleted', async () => {
    db = await signedInDb(USER)
    const { t } = await pushDay(db)
    const copy = await duplicateTemplate(t.id, db)
    await deleteTemplate(copy.id, db)
    expect((await getTemplateTree(t.id, db))?.exercises).toHaveLength(3)
    expect((await listTemplateSummaries(db)).map((s) => s.name)).toEqual(['Push Day'])
  })

  it('reorders exercises', async () => {
    db = await signedInDb(USER)
    const { t, ids } = await pushDay(db)
    const [a, b, c] = ids as [string, string, string]
    await reorderTemplateExercises(t.id, [c, a, b], c, db)
    expect((await getTemplateTree(t.id, db))?.exercises.map((e) => e.row.id)).toEqual([c, a, b])
  })

  it('groups a superset next to each other with the next free letter, and ungroups it', async () => {
    db = await signedInDb(USER)
    const { t, ids } = await pushDay(db)
    const [a, b, c] = ids as [string, string, string]
    await groupSuperset(t.id, [a, c], db)
    let tree = await getTemplateTree(t.id, db)
    expect(tree?.exercises.map((e) => [e.row.id, e.row.position, e.row.supersetGroup])).toEqual([
      [a, 0, 'A'],
      [c, 1, 'A'],
      [b, 2, null],
    ])
    await groupSuperset(t.id, [b, c], db)
    tree = await getTemplateTree(t.id, db)
    // c moved to the new group, leaving a alone, so a's group is cleared.
    expect(tree?.exercises.map((e) => [e.row.id, e.row.supersetGroup])).toEqual([
      [a, null],
      [c, 'B'],
      [b, 'B'],
    ])
    await ungroupSuperset(t.id, [b], db)
    tree = await getTemplateTree(t.id, db)
    expect(tree?.exercises.map((e) => e.row.supersetGroup)).toEqual([null, null, null])
  })

  it('lists summaries with exercise names in order', async () => {
    db = await signedInDb(USER)
    await pushDay(db)
    await createTemplate({ name: 'Leg Day' }, db)
    expect((await listTemplateSummaries(db)).map((s) => [s.name, s.exerciseNames])).toEqual([
      ['Push Day', ['Bench', 'Incline DB', 'Dips']],
      ['Leg Day', []],
    ])
  })

  it('keeps supersets contiguous after a reorder or a removal', async () => {
    db = await signedInDb(USER)
    const { t, ids } = await pushDay(db)
    const [a, b, c] = ids as [string, string, string]
    await groupSuperset(t.id, [a, b], db)
    // Drag c between a and b: it joins A.
    await reorderTemplateExercises(t.id, [a, c, b], c, db)
    let tree = await getTemplateTree(t.id, db)
    expect(tree?.exercises.map((e) => e.row.supersetGroup)).toEqual(['A', 'A', 'A'])
    // Remove two members: the last one alone is no longer a superset.
    await removeTemplateExercise(a, db)
    await removeTemplateExercise(c, db)
    tree = await getTemplateTree(t.id, db)
    expect(tree?.exercises.map((e) => [e.row.id, e.row.position, e.row.supersetGroup])).toEqual([
      [b, 0, null],
    ])
  })
})

describe('normalizeSupersets', () => {
  const items = (groups: (string | null)[]) =>
    groups.map((supersetGroup, i) => ({ id: String(i), supersetGroup }))
  it.each<[string, (string | null)[], number | undefined, (string | null)[]]>([
    ['untouched', ['A', 'A', null, 'B', 'B'], undefined, ['A', 'A', null, 'B', 'B']],
    ['dropped inside a group joins it', ['A', null, 'A'], 1, ['A', 'A', 'A']],
    ['dropped inside another group joins it', ['A', 'B', 'A', 'B'], 1, ['A', 'A', 'A', null]],
    ['dragged out of its group leaves it', ['A', 'A', null, 'A'], 3, ['A', 'A', null, null]],
    ['reordered within its group stays', ['A', 'A', 'A'], 0, ['A', 'A', 'A']],
    ['group of one is cleared', ['A', null, 'B', 'B'], undefined, [null, null, 'B', 'B']],
    [
      'a split group keeps its first run',
      ['A', 'A', null, 'A', 'A'],
      undefined,
      ['A', 'A', null, null, null],
    ],
  ])('%s', (_, input, moved, expected) => {
    expect(
      normalizeSupersets(items(input), moved === undefined ? undefined : String(moved)),
    ).toEqual(expected)
  })
})
